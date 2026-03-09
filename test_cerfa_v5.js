// Test script to generate CERFA v5 PDF (with contrepartie + no 978)
const path = require('path');
const PDFDocument = require(path.join(__dirname, 'functions/node_modules/pdfkit'));
const fs = require('fs');

const outputPath = path.join(__dirname, 'test_cerfa_v5.pdf');

const doc = new PDFDocument({
  size: 'A4',
  margin: { top: 30, bottom: 25, left: 40, right: 40 },
});

const stream = fs.createWriteStream(outputPath);
doc.pipe(stream);

const boxLeft = 40;
const contentRight = 595.28 - 40;
const contentWidth = contentRight - boxLeft;
const boxInner = boxLeft + 8;

// === EN-TÊTE CERFA ===
doc.fontSize(14).font('Helvetica-Bold').text('REÇU AU TITRE DES DONS', { align: 'center' });
doc.fontSize(9).font('Helvetica').text('À DES ORGANISMES D\'INTÉRÊT GÉNÉRAL', { align: 'center' });
doc.fontSize(8).text('Article 200 du code général des impôts (CGI)', { align: 'center' });
doc.moveDown(0.2);
doc.fontSize(7).fillColor('#666666').text('N° CERFA 11580*05', { align: 'center' });
doc.fillColor('#000000');
doc.moveDown(0.4);

// Numéro et date
doc.fontSize(9).font('Helvetica-Bold');
doc.text('Reçu n° : RF-2026-001', boxLeft, doc.y, { continued: true, width: contentWidth });
doc.font('Helvetica').text(`Date d'émission : ${new Date().toLocaleDateString('fr-FR')}`, { align: 'right' });
doc.moveDown(0.6);

// === CADRE 1 : Organisme ===
const box1H = 150;
doc.rect(boxLeft, doc.y, contentWidth, box1H).stroke();
const box1Y = doc.y + 6;
doc.fontSize(9).font('Helvetica-Bold').text('1. ORGANISME BÉNÉFICIAIRE', boxInner, box1Y);
doc.moveDown(0.3);
doc.fontSize(8).font('Helvetica');
doc.text('Nom : Centre Culturel Islamique de Bourg-en-Bresse — El Mouhssinine', boxInner);
doc.text('Adresse : 47 avenue de Jasseron  01000 Bourg-en-Bresse', boxInner);
doc.text('N° SIREN/RNA : W012004130  —  Statut : Association cultuelle loi 1905', boxInner);
doc.text('Objet : Exercice du culte musulman', boxInner);
doc.moveDown(0.2);
doc.fontSize(7).font('Helvetica-Bold').text('Catégorie au regard de l\'article 200 du CGI :', boxInner);
doc.font('Helvetica');
doc.text('[  ] Œuvre ou organisme d\'intérêt général   [  ] Fondation ou association reconnue d\'utilité publique', boxInner);
doc.text('[  ] Fondation d\'entreprise   [  ] Établissement d\'enseignement supérieur ou artistique', boxInner);
doc.text('[X] Association cultuelle ou de bienfaisance autorisée à recevoir des dons et legs', boxInner);
doc.y = box1Y + box1H + 4;

// === CADRE 2 : Donateur ===
const box2H = 70;
doc.rect(boxLeft, doc.y, contentWidth, box2H).stroke();
const box2Y = doc.y + 6;
doc.fontSize(9).font('Helvetica-Bold').text('2. DONATEUR (Particulier)', boxInner, box2Y);
doc.moveDown(0.2);
doc.fontSize(8).font('Helvetica');
doc.text('Nom : DUPONT   Prénom : Jean', boxInner);
doc.text('Adresse : 12 rue de la Paix  01000 Bourg-en-Bresse', boxInner);
doc.y = box2Y + box2H + 4;

// === CADRE 3 : Don ===
const box3H = 115;
doc.rect(boxLeft, doc.y, contentWidth, box3H).stroke();
const box3Y = doc.y + 6;
doc.fontSize(9).font('Helvetica-Bold').text('3. DON', boxInner, box3Y);
doc.moveDown(0.2);
doc.fontSize(8).font('Helvetica');
doc.text('Date du (des) versement(s) : 15/01/2026     Mode de versement : Carte bancaire', boxInner);
doc.moveDown(0.3);
doc.font('Helvetica-Bold').fontSize(11);
doc.text('Montant : 50.00 €', boxInner);
doc.font('Helvetica').fontSize(8);
doc.text('Soit en toutes lettres : cinquante euros', boxInner);
doc.moveDown(0.2);
doc.text('Nature du don : Don en numéraire', boxInner);
doc.moveDown(0.2);
doc.text('Forme du don :   [  ] Acte authentique   [  ] Acte sous seing privé   [X] Don manuel   [  ] Autres', boxInner);
doc.y = box3Y + box3H + 4;

// === CADRE 4 : Dispositif ===
const box4H = 55;
doc.rect(boxLeft, doc.y, contentWidth, box4H).stroke();
const box4Y = doc.y + 6;
doc.fontSize(9).font('Helvetica-Bold').text('4. DISPOSITIF LÉGAL APPLICABLE', boxInner, box4Y);
doc.moveDown(0.2);
doc.fontSize(7).font('Helvetica');
doc.text('Le bénéficiaire certifie sur l\'honneur que les dons et versements qu\'il reçoit ouvrent droit à la réduction d\'impôt prévue à l\'article :', boxInner);
doc.moveDown(0.2);
doc.fontSize(9).font('Helvetica');
doc.text('[X] 200 du CGI (impôt sur le revenu)     [  ] 978 du CGI (IFI — impôt sur la fortune immobilière)', boxInner);
doc.y = box4Y + box4H + 4;

console.log('Y after box4:', doc.y);

// === Mentions légales ===
doc.moveDown(0.2);
doc.fontSize(7).font('Helvetica');
doc.text(
  'Ce don ouvre droit à une réduction d\'impôt sur le revenu égale à 66% du montant versé, dans la limite de 20% du revenu imposable. Si le montant des dons dépasse cette limite, l\'excédent est reporté sur les 5 années suivantes.',
  boxLeft, doc.y, { width: contentWidth, align: 'justify' }
);

console.log('Y after mentions:', doc.y);

// === PHRASE ABSENCE CONTREPARTIE (NEW) ===
doc.moveDown(0.2);
doc.fontSize(7).font('Helvetica-Oblique').fillColor('#333333');
doc.text(
  'Le don a été effectué sans aucune contrepartie directe ou indirecte au profit du donateur.',
  boxLeft, doc.y, { width: contentWidth, align: 'center' }
);
doc.font('Helvetica').fillColor('#000000');

console.log('Y after contrepartie:', doc.y);

// === BLOC SIGNATURE (bas-droite, position fixe) ===
const sigBlockX = contentRight - 200;
const sigBlockY = 610;

doc.fontSize(9).font('Helvetica');
doc.text(`Fait à Bourg-en-Bresse, le ${new Date().toLocaleDateString('fr-FR')}`, sigBlockX, sigBlockY, { width: 200, align: 'right' });
doc.moveDown(0.3);
doc.text('Le Président', sigBlockX, doc.y, { width: 200, align: 'right' });
doc.text('M. Khalid BOUYARMANE', sigBlockX, doc.y, { width: 200, align: 'right' });

console.log('Y after signature:', doc.y);

// === FOOTER (tout en bas de la page 1) ===
doc.fontSize(6).font('Helvetica').text(
  'Document à conserver. Il vous permet de bénéficier d\'une réduction d\'impôt. Ne pas joindre à la déclaration de revenus.',
  boxLeft, 790, { align: 'center', width: contentWidth }
);

doc.end();

stream.on('finish', () => {
  const stats = fs.statSync(outputPath);
  console.log(`\n✅ PDF généré: ${outputPath} (${stats.size} bytes)`);
  console.log('Open with: open test_cerfa_v5.pdf');
});
