const { test } = require('node:test');
const assert = require('node:assert/strict');
const { sendThirdFailureReminder, buildReminderText, ENABLED_FROM } = require('../paymentFailureReminder');

function fixture(options = {}) {
  const records = new Map();
  const sends = [];
  const errors = [];
  let queue = Promise.resolve();
  let member = { status: 'expire', cotisationType: 'mensuel',
    stripeSubscriptionId: 'sub_fixture', stripeCustomerId: 'cus_fixture',
    prenom: 'Camille', ...options.member };
  let invoice = { id: 'in_fixture', customer: 'cus_fixture', subscription: 'sub_fixture',
    status: 'open', amount_remaining: 834, attempt_count: 3, ...options.invoice };
  let subscription = { id: 'sub_fixture', customer: 'cus_fixture',
    status: 'past_due', latest_invoice: 'in_fixture', ...options.subscription };
  const memberKey = 'members/member-fixture';
  records.set(memberKey, member);
  const snapshot = (key) => ({ exists: records.has(key), data: () => records.get(key), ref: ref(key) });
  function ref(key) {
    return { id: key.split('/')[1], key, get: async () => snapshot(key),
      update: async (patch) => {
        if (options.sentWriteFails && patch.status === 'sent') throw Error('synthetic write outage');
        records.set(key, { ...records.get(key), ...patch });
      } };
  }
  const db = {
    collection: (name) => ({ doc: (id) => ref(`${name}/${id}`) }),
    runTransaction(callback) {
      const current = queue.then(async () => {
        const writes = [];
        const result = await callback({
          get: async (r) => { assert.equal(writes.length, 0); return snapshot(r.key); },
          set: (r, data) => writes.push(() => records.set(r.key, data)),
        });
        writes.forEach((write) => write());
        return result;
      });
      queue = current.catch(() => {});
      return current;
    },
  };
  let reads = 0;
  const input = {
    event: { created: ENABLED_FROM + 1 },
    invoice, subscription, memberDoc: snapshot(memberKey), customerEmail: 'membre@example.test',
    db, fieldValue: { serverTimestamp: () => new Date() },
    stripe: { invoices: { retrieve: async () => {
      if (options.paidBeforeSend && ++reads === 2) return { ...invoice, status: 'paid', amount_remaining: 0 };
      return invoice;
    } }, subscriptions: { retrieve: async () => subscription } },
    createTransport: (config) => ({ sendMail: async (mail) => {
      assert.equal(config.logger, false);
      sends.push(mail);
      if (options.smtpError) throw options.smtpError;
      return options.smtpInfo || { accepted: ['membre@example.test'], messageId: 'synthetic-message' };
    } }),
    renderHtml: (body) => `<p>${body.replaceAll('<', '&lt;').replaceAll('>', '&gt;')}</p>`,
    smtp: { user: 'fixture', pass: 'fixture-password', fromEmail: 'sender@example.test', fromName: 'Mosquée' },
    reportError: async (...args) => errors.push(args),
  };
  return { input, records, sends, errors, send: () => sendThirdFailureReminder(input) };
}

for (const count of [1, 2]) test(`no email before threshold: ${count} refusals`, async () => {
  const f = fixture({ invoice: { attempt_count: count } });
  await f.send();
  assert.equal(f.sends.length, 0);
});

test('third refusal sends a gentle message with the real app labels', async () => {
  const f = fixture();
  assert.equal(await f.send(), 'sent');
  assert.equal(f.sends.length, 1);
  assert.match(f.sends[0].text, /Mes adhésions/);
  assert.match(f.sends[0].text, /Mettre à jour ma carte/);
  assert.match(f.sends[0].text, /Si vous souhaitez poursuivre/);
  assert.match(f.sends[0].text, /règlement de la cotisation en attente/);
  assert.doesNotMatch(f.sends[0].text, /suspendu|sanction|obligatoire|dernière chance/i);
  assert.match(f.sends[0].replyTo, /@orange\.fr$/);
  assert.equal(f.records.get('payment_failure_emails/in_fixture').status, 'sent');
});

test('replay and fourth refusal cannot send the reminder again for the same invoice', async () => {
  const f = fixture();
  await f.send();
  f.input.invoice.attempt_count = 4;
  await f.send();
  assert.equal(f.sends.length, 1);
});

test('concurrent deliveries reserve only one send', async () => {
  const f = fixture();
  await Promise.all([f.send(), f.send()]);
  assert.equal(f.sends.length, 1);
});

for (const subscription of [
  { cancel_at_period_end: true }, { status: 'canceled' }, { latest_invoice: 'in_other' },
]) test(`no reminder for canceled or historical subscription: ${JSON.stringify(subscription)}`, async () => {
  const f = fixture({ subscription }); await f.send(); assert.equal(f.sends.length, 0);
});

for (const member of [
  { subscriptionCancelPending: true }, { status: 'annule' },
  { cotisationType: 'annuel' }, { stripeSubscriptionId: 'sub_other' },
]) test(`respect member and app eligibility: ${JSON.stringify(member)}`, async () => {
  const f = fixture({ member }); await f.send(); assert.equal(f.sends.length, 0);
});

test('paid invoice and recorded success both suppress the email', async () => {
  const paid = fixture({ invoice: { status: 'paid', amount_remaining: 0 } });
  await paid.send(); assert.equal(paid.sends.length, 0);
  const processed = fixture();
  processed.records.set('processed_payments/in_fixture', { type: 'invoice_payment' });
  await processed.send(); assert.equal(processed.sends.length, 0);
});

test('a settlement between reservation and SMTP suppresses the email', async () => {
  const f = fixture({ paidBeforeSend: true });
  await f.send(); assert.equal(f.sends.length, 0);
});

test('old events are not backfilled and no recipient is not a send', async () => {
  const old = fixture(); old.input.event.created = ENABLED_FROM - 1;
  await old.send(); assert.equal(old.sends.length, 0);
  const noEmail = fixture(); noEmail.input.customerEmail = '';
  await noEmail.send(); assert.equal(noEmail.sends.length, 0);
});

test('ambiguous SMTP outcome is retained and never blindly resent', async () => {
  const err = Object.assign(Error('synthetic timeout'), { code: 'ETIMEDOUT', command: 'DATA' });
  const f = fixture({ smtpError: err });
  await f.send(); await f.send();
  assert.equal(f.sends.length, 1);
  assert.equal(f.records.get('payment_failure_emails/in_fixture').status, 'unknown');
  assert.ok(f.errors.length > 0);
});

test('a connection closed during DATA is also ambiguous, not a safe retry', async () => {
  const err = Object.assign(Error('synthetic disconnect'), { code: 'ECONNECTION', command: 'DATA' });
  const f = fixture({ smtpError: err });
  await f.send(); await f.send();
  assert.equal(f.sends.length, 1);
  assert.equal(f.records.get('payment_failure_emails/in_fixture').status, 'unknown');
});

test('accepted email with failed sent-marker persistence is not resent', async () => {
  const f = fixture({ sentWriteFails: true });
  await f.send(); await f.send();
  assert.equal(f.sends.length, 1);
  assert.ok(f.errors.length > 0);
});

test('a definite SMTP rejection allows the webhook to retry without pretending success', async () => {
  const err = Object.assign(Error('synthetic rejection'), { responseCode: 451 });
  const f = fixture({ smtpError: err });
  await assert.rejects(f.send());
  assert.equal(f.records.get('payment_failure_emails/in_fixture').status, 'retryable');
});

test('plain text names remain text in the rendered HTML', async () => {
  const f = fixture({ member: { prenom: '<img src=x>' } });
  await f.send(); assert.doesNotMatch(f.sends[0].html, /<img/);
  assert.match(buildReminderText('Camille'), /Salam alaykoum Camille/);
});
