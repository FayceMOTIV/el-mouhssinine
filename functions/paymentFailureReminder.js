'use strict';

// Do not send catch-up messages for events predating this feature request.
const ENABLED_FROM = Date.parse('2026-11-16T10:44:51Z') / 1000;
const REPLY_TO = 'centreculturelislamique@orange.fr';
const objectId = (value) => typeof value === 'string' ? value : value?.id;

function buildReminderText(prenom = '') {
  return `Salam alaykoum${prenom ? ' ' + prenom : ''},

Nous vous écrivons simplement pour vous informer que le paiement de votre cotisation mensuelle via l'application El Mouhssinine n'a pas pu aboutir malgré plusieurs tentatives. Cela peut arriver, notamment lorsqu'une carte a été renouvelée.

Si vous souhaitez poursuivre votre adhésion, vous pouvez mettre votre carte à jour directement dans l'application El Mouhssinine :

1. Ouvrez l'application et connectez-vous.
2. Allez dans « Mes adhésions ».
3. Appuyez sur « Mettre à jour ma carte », puis suivez les indications.

L'enregistrement d'une nouvelle carte peut entraîner le règlement de la cotisation en attente. Aucun numéro de carte n'est à nous envoyer par mail.

Si vous rencontrez une difficulté ou souhaitez simplement faire le point, l'équipe de la mosquée reste à votre écoute : ${REPLY_TO}.

Merci pour votre confiance. Prenez soin de vous.

L'équipe El Mouhssinine`;
}

function eligible(invoice, subscription, member) {
  return invoice?.status === 'open' && invoice.amount_remaining > 0
    && Number.isInteger(invoice.attempt_count) && invoice.attempt_count >= 3
    && invoice.billing_reason !== 'subscription_create'
    && ['past_due', 'unpaid'].includes(subscription?.status)
    && !subscription.cancel_at_period_end && !member?.subscriptionCancelPending
    && member?.status !== 'annule' && member?.status !== 'en_attente_paiement'
    && member?.cotisationType === 'mensuel'
    && member.stripeSubscriptionId === subscription.id
    && member.stripeCustomerId === objectId(subscription.customer)
    && objectId(invoice.customer) === objectId(subscription.customer)
    && objectId(subscription.latest_invoice) === invoice.id;
}

function definitelyNotDelivered(error) {
  return ['EDNS', 'EAUTH', 'EENVELOPE'].includes(error.code)
    || error.command === 'CONN'
    || (error.responseCode >= 400 && error.responseCode <= 599);
}

async function sendThirdFailureReminder({ event, invoice, subscription, memberDoc,
  customerEmail, db, fieldValue, stripe, createTransport, renderHtml, smtp, reportError }) {
  if (!Number.isFinite(event?.created) || event.created < ENABLED_FROM
    || !memberDoc || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail || '')
    || !eligible(invoice, subscription, memberDoc.data())) return 'skipped';

  if (!smtp.user || !smtp.pass || !smtp.fromEmail) {
    await reportError('Configuration du rappel de carte indisponible', 'payment_failure_reminder_config');
    throw new Error('Reminder SMTP configuration unavailable');
  }

  // Recheck the current debt; the event itself may have been delayed.
  const [currentInvoice, currentSubscription, association] = await Promise.all([
    stripe.invoices.retrieve(invoice.id, { timeout: 10000, maxNetworkRetries: 0 }),
    stripe.subscriptions.retrieve(subscription.id, { timeout: 10000, maxNetworkRetries: 0 }),
    db.collection('settings').doc('association').get(),
  ]);
  if (!eligible(currentInvoice, currentSubscription, memberDoc.data())) return 'skipped';

  const mailRef = db.collection('payment_failure_emails').doc(invoice.id);
  const paidRef = db.collection('processed_payments').doc(invoice.id);
  const claimed = await db.runTransaction(async (transaction) => {
    const mail = await transaction.get(mailRef);
    const paid = await transaction.get(paidRef);
    const member = await transaction.get(memberDoc.ref);
    if (paid.exists || !member.exists
      || !eligible(currentInvoice, currentSubscription, member.data())) return false;
    // SMTP has no exactly-once API. An interrupted/ambiguous send stays
    // reserved rather than risking a second email to the same person.
    if (mail.exists && mail.data().status !== 'retryable') return false;
    transaction.set(mailRef, {
      status: 'sending', kind: 'third_failure_card_update',
      invoiceId: invoice.id, memberId: memberDoc.id,
      attemptCount: currentInvoice.attempt_count,
      claimedAt: fieldValue.serverTimestamp(),
    });
    return true;
  });
  if (!claimed) return 'skipped';

  let phase = 'preflight';
  let accepted = false;
  try {
    const [lastInvoice, lastSubscription, lastMember, paid] = await Promise.all([
      stripe.invoices.retrieve(invoice.id, { timeout: 10000, maxNetworkRetries: 0 }),
      stripe.subscriptions.retrieve(subscription.id, { timeout: 10000, maxNetworkRetries: 0 }),
      memberDoc.ref.get(), paidRef.get(),
    ]);
    if (paid.exists || !lastMember.exists
      || !eligible(lastInvoice, lastSubscription, lastMember.data())) {
      await mailRef.update({ status: 'skipped', checkedAt: fieldValue.serverTimestamp() });
      return 'skipped';
    }

    const text = buildReminderText(lastMember.data().prenom || '');
    const assoc = association.exists ? association.data() : {};
    const html = renderHtml(text, {
      headerTitle: 'Un petit point sur votre cotisation',
      headerGradient: '#8d7850, #b39a67',
      footerAssociation: assoc.nom || 'Mosquée El Mouhssinine',
      footerAdresse: assoc.adresse || '', footerTelephone: assoc.telephone || '',
    });
    const transport = createTransport({
      host: 'smtp-relay.brevo.com', port: 587, secure: false, requireTLS: true,
      auth: { user: smtp.user, pass: smtp.pass },
      connectionTimeout: 8000, greetingTimeout: 8000, socketTimeout: 15000,
      logger: false, debug: false,
    });
    phase = 'smtp';
    const info = await transport.sendMail({
      from: { name: smtp.fromName || 'Mosquée El Mouhssinine', address: smtp.fromEmail },
      to: customerEmail, replyTo: REPLY_TO,
      subject: 'Un petit point sur votre cotisation', text, html,
      messageId: `<card-update-${invoice.id}@centrecultureislamiquebourg.fr>`,
    });
    if (!info.accepted?.length) {
      throw Object.assign(new Error('Recipient not accepted'), { code: 'EENVELOPE' });
    }
    accepted = true;
    await mailRef.update({ status: 'sent', sentAt: fieldValue.serverTimestamp(),
      messageId: info.messageId || null });
    return 'sent';
  } catch (error) {
    if (accepted) {
      // The email was accepted. Even if persisting its receipt failed, never
      // send again: the existing sending marker remains a duplicate guard.
      await reportError('Rappel accepté par SMTP, reçu à vérifier', 'payment_failure_reminder_receipt');
      return 'unknown';
    }
    const retryable = phase === 'preflight' || definitelyNotDelivered(error);
    await mailRef.update({ status: retryable ? 'retryable' : 'unknown',
      checkedAt: fieldValue.serverTimestamp() });
    await reportError(retryable ? 'Rappel de carte non remis, nouvelle tentative nécessaire'
      : 'Issue SMTP du rappel incertaine, aucun renvoi automatique', 'payment_failure_reminder');
    if (retryable) throw new Error('Reminder not delivered; retry required');
    return 'unknown';
  }
}

module.exports = { sendThirdFailureReminder, buildReminderText, ENABLED_FROM };
