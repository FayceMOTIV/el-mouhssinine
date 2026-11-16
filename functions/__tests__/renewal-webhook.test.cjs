const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { sendThirdFailureReminder } = require('../paymentFailureReminder');

// Execute the production webhook body, with transaction storage and Stripe at
// the boundary. Never load credentials, Firebase services, or a real transport.
const source = fs.readFileSync(path.join(__dirname, '..', 'index.js'), 'utf8');
const webhookSource = source.slice(source.indexOf('exports.stripeWebhook ='),
    source.indexOf('// ==================== REÇUS FISCAUX'));
const templateHelpersSource = source.slice(source.indexOf('const escapeHtml ='),
    source.indexOf('exports.onNewAnnouncement ='));

function harness(member = {}, options = {}) {
  const now = new Date();
  const data = new Map([['members/member-test', {
    prenom: 'Membre', nom: 'Test', status: 'expire', paymentFailed: true,
    paymentFailedCount: 6, paymentFailedAt: now,
    validatedAt: now, validatedBy: 'admin-test',
    cotisationType: 'mensuel', stripeSubscriptionId: 'sub_test', stripeCustomerId: 'cus_test',
    cotisation: { type: 'mensuel', dateFin: now }, ...member,
  }]]);
  const alerts = [];
  const emails = [];
  const deletion = Symbol('delete');
  const invoice = { id: 'in_test', subscription: 'sub_test',
    customer: 'cus_test', payment_intent: 'pi_test', amount_paid: 834,
    amount_due: 834, amount_remaining: 0, currency: 'eur', status: 'paid',
    billing_reason: 'subscription_cycle', attempt_count: 3, ...options.invoice };
  const subscription = { id: 'sub_test', customer: 'cus_test',
    latest_invoice: 'in_test', status: 'active', ...options.subscription };
  const snapshot = (key) => ({ exists: data.has(key), id: key.split('/')[1],
    data: () => data.get(key), ref: ref(key) });
  function ref(key) {
    return { key, get: async () => snapshot(key), update: async (v) => apply(key, v),
      set: async (v) => data.set(key, v) };
  }
  function apply(key, patch) {
    const value = { ...data.get(key), ...patch };
    for (const [k, v] of Object.entries(patch)) if (v === deletion) delete value[k];
    data.set(key, value);
  }
  const db = {
    collection(name) {
      const query = { where: () => query, limit: () => query,
        get: async () => ({ empty: false, docs: [snapshot('members/member-test')] }) };
      return { ...query, doc: (id) => ref(`${name}/${id}`),
        add: async (value) => alerts.push({ collection: name, value }) };
    },
    async runTransaction(callback) {
      const writes = [];
      const transaction = {
        get: async (r) => {
          assert.equal(writes.length, 0, 'Firestore reads must precede writes');
          return snapshot(r.key);
        },
        set: (r, v) => writes.push(() => data.set(r.key, v)),
        update: (r, v) => writes.push(() => apply(r.key, v)),
      };
      const result = await callback(transaction);
      writes.forEach((write) => write());
      return result;
    },
  };
  const firestore = Object.assign(() => db, {
    FieldValue: { delete: () => deletion, serverTimestamp: () => new Date() },
    Timestamp: { fromDate: (date) => date },
  });
  const chain = { region: () => chain, https: { onRequest: (handler) => handler } };
  const context = { exports: {}, functions: { runWith: () => chain },
    admin: { firestore }, console: { log() {}, warn() {}, error() {} },
    STRIPE_WEBHOOK_SECRET_VALUE: () => 'synthetic-signature-secret',
    BREVO_SMTP_USER: options.emailEnabled ? 'fixture' : '',
    BREVO_SMTP_PASS: options.emailEnabled ? 'synthetic-password' : '',
    BREVO_FROM_EMAIL: options.emailEnabled ? 'sender@example.test' : '', BREVO_FROM_NAME: '',
    nodemailer: { createTransport: () => ({ sendMail: async (mail) => {
      emails.push(mail); return { accepted: ['membre@example.test'], messageId: 'synthetic-message' };
    } }) },
    sendThirdFailureReminder,
    stripe: { webhooks: { constructEvent: (event) => event },
      invoices: { retrieve: async () => {
        if (options.invoiceReadFails) throw Error('synthetic Stripe outage');
        return invoice;
      } },
      subscriptions: { retrieve: async () => subscription },
      customers: { retrieve: async () => ({ email: options.emailEnabled ? 'membre@example.test' : '' }) },
    },
    sendPushToMember: async () => alerts.push({ type: 'push' }),
    createNotifBO: async () => alerts.push({ type: 'backoffice' }),
    logServerError: async () => {},
  };
  vm.runInNewContext(templateHelpersSource + '\n' + webhookSource, context);
  async function deliver(type = 'invoice.payment_succeeded') {
    const response = { code: 200, status(code) { this.code = code; return this; },
      send(body) { this.body = body; return this; }, json(body) { this.body = body; return this; } };
    await context.exports.stripeWebhook({ headers: {}, rawBody: {
      type, created: Math.floor(Date.now() / 1000), data: { object: invoice },
    } }, response);
    return response;
  }
  return { data, alerts, emails, deliver, member: () => data.get('members/member-test') };
}

test('successful renewal clears the failure flag and restores a previously validated member', async () => {
  const h = harness();
  assert.equal((await h.deliver()).code, 200);
  assert.equal(h.member().paymentFailed, false);
  assert.equal(h.member().paymentFailedCount, 0);
  assert.equal(h.member().paymentFailedAt, undefined);
  assert.equal(h.member().status, 'actif');
  assert.equal(h.member().paiementTentative.issue, 'paye');
  assert.equal(h.data.get('payments/in_test').amount, 8.34);
});

for (const status of ['en_attente_validation', 'en_attente_signature', 'sympathisant', 'annule']) {
  test(`payment never bypasses admin status ${status}`, async () => {
    const h = harness({ status });
    await h.deliver();
    assert.equal(h.member().status, status);
    assert.equal(h.member().paymentFailed, false);
  });
}

test('expired member without proof of admin approval is not activated', async () => {
  const h = harness({ validatedAt: null, validatedBy: null });
  await h.deliver();
  assert.equal(h.member().status, 'expire');
});

test('an expiration unrelated to payment failure is not undone', async () => {
  const h = harness({ paymentFailed: false });
  await h.deliver();
  assert.equal(h.member().status, 'expire');
});

test('an active member remains active after a settled renewal', async () => {
  const h = harness({ status: 'actif' });
  await h.deliver();
  assert.equal(h.member().status, 'actif');
  assert.equal(h.member().paymentFailed, false);
});

test('expanded latest invoice is supported', async () => {
  const h = harness({}, { subscription: { latest_invoice: { id: 'in_test' } } });
  await h.deliver();
  assert.equal(h.member().status, 'actif');
});

test('an unpaid invoice cannot remove the failure flag', async () => {
  const h = harness({}, { invoice: { status: 'open', amount_paid: 0, amount_remaining: 834 } });
  await h.deliver();
  assert.equal(h.member().paymentFailed, true);
  assert.equal(h.member().status, 'expire');
});

test('a historical invoice does not clear the current outstanding debt', async () => {
  const h = harness({}, { subscription: { latest_invoice: 'in_newer_unpaid', status: 'past_due' } });
  await h.deliver();
  assert.equal(h.member().paymentFailed, true);
  assert.equal(h.member().paymentFailedCount, 6);
  assert.equal(h.member().status, 'expire');
});

test('duplicate renewal does not extend membership twice', async () => {
  const h = harness();
  await h.deliver();
  const expiry = h.member().cotisation.dateFin.getTime();
  await h.deliver();
  assert.equal(h.member().cotisation.dateFin.getTime(), expiry);
  assert.equal([...h.data.keys()].filter((key) => key.startsWith('payments/')).length, 1);
});

test('cancel pending never activates the member', async () => {
  const h = harness({ subscriptionCancelPending: true });
  await h.deliver();
  assert.equal(h.member().status, 'expire');
});

test('a genuine third refusal is still reported and expires an active member', async () => {
  const h = harness({ status: 'actif', paymentFailed: false }, {
    invoice: { status: 'open', amount_paid: 0, amount_remaining: 834 },
    subscription: { status: 'past_due' },
  });
  await h.deliver('invoice.payment_failed');
  assert.equal(h.member().paymentFailed, true);
  assert.equal(h.member().status, 'expire');
  assert.ok(h.alerts.some((a) => a.type === 'backoffice'));
});

test('delayed failure event for an already paid invoice produces no false alerts', async () => {
  const h = harness({ status: 'actif', paymentFailed: false, paymentFailedCount: 0 });
  await h.deliver('invoice.payment_failed');
  assert.equal(h.member().paymentFailed, false);
  assert.equal(h.member().status, 'actif');
  assert.equal(h.alerts.length, 0);
});

test('a recorded successful invoice wins over a racing failure event', async () => {
  const h = harness({ status: 'actif', paymentFailed: false }, {
    invoice: { status: 'open', amount_paid: 0, amount_remaining: 834 },
    subscription: { status: 'past_due' },
  });
  h.data.set('processed_payments/in_test', { type: 'invoice_payment' });
  await h.deliver('invoice.payment_failed');
  assert.equal(h.member().paymentFailed, false);
  assert.equal(h.member().status, 'actif');
  assert.equal(h.alerts.length, 0);
});

test('unverifiable failure event is retried without changing or notifying the member', async () => {
  const h = harness({ status: 'actif', paymentFailed: false }, { invoiceReadFails: true });
  assert.equal((await h.deliver('invoice.payment_failed')).code, 500);
  assert.equal(h.member().paymentFailed, false);
  assert.equal(h.alerts.length, 0);
});

test('production webhook sends no payment email for the first two failures', async () => {
  for (const attempt_count of [1, 2]) {
    const h = harness({ status: 'actif', paymentFailed: false }, {
      emailEnabled: true, invoice: { attempt_count, status: 'open', amount_paid: 0, amount_remaining: 834 },
      subscription: { status: 'past_due' },
    });
    assert.equal((await h.deliver('invoice.payment_failed')).code, 200);
    assert.equal(h.emails.length, 0);
  }
});

test('production webhook uses the gentle reminder once across duplicate refusals', async () => {
  const h = harness({ status: 'actif', paymentFailed: false }, {
    emailEnabled: true, invoice: { status: 'open', amount_paid: 0, amount_remaining: 834 },
    subscription: { status: 'past_due' },
  });
  await h.deliver('invoice.payment_failed');
  await h.deliver('invoice.payment_failed');
  assert.equal(h.emails.length, 1);
  assert.match(h.emails[0].text, /Mettre à jour ma carte/);
  assert.match(h.emails[0].html, /Mes adhésions/);
  assert.doesNotMatch(h.emails[0].html, /suspendu|sympathisant/);
});
