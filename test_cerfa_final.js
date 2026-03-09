// Test CERFA FINAL - avec vrai cachet + vraies infos association depuis Firestore
const path = require('path');
const PDFDocument = require(path.join(__dirname, 'functions/node_modules/pdfkit'));
const fs = require('fs');

const outputPath = path.join(__dirname, 'test_cerfa_final.pdf');
const cachetPath = '/tmp/cachet-association.png';

const doc = new PDFDocument({
  size: 'A4',
  margins: { top: 30, bottom: 25, left: 40, right: 40 },
});

const stream = fs.createWriteStream(outputPath);
doc.pipe(stream);

const pageWidth = 595.28;
const contentLeft = 40;
const contentRight = pageWidth - 40;
const contentWidth = contentRight - contentLeft;
const boxLeft = contentLeft;
const boxInner = contentLeft + 10;

// Vraies infos association depuis Firestore settings/association
const association = {
  nom: 'Association Centre Culturel Islamique de Bourg-en-Bresse',
  adresse: '29 rue de la Croix Blanche',
  codePostal: '01000',
  ville: 'Bourg-en-Bresse',
  siren: '409545316',
  statut: 'Association cultuelle loi 1905',
  objet: 'Exercice du culte musulman',
  signataire: 'Le Président',
  nomSignataire: 'M. Khalid BOUYARMANE',
};

// === EN-TETE CERFA ===
doc.fontSize(14).font('Helvetica-Bold').text('RECU AU TITRE DES DONS', { align: 'center' });
doc.fontSize(9).font('Helvetica').text('A DES ORGANISMES D\'INTERET GENERAL', { align: 'center' });
doc.fontSize(8).text('Article 200 du code general des impots (CGI)', { align: 'center' });
doc.moveDown(0.2);
doc.fontSize(7).fillColor('#666666').text('N\u00B0 CERFA 11580*05', { align: 'center' });
doc.fillColor('#000000');
doc.moveDown(0.4);

// Numero et date
doc.fontSize(9).font('Helvetica-Bold');
doc.text('Recu n\u00B0 : RF-2026-001', boxLeft, doc.y, { continued: true, width: contentWidth });
doc.font('Helvetica').text('Date d\'emission : 16/02/2026', { align: 'right' });
doc.moveDown(0.6);

// === CADRE 1 : Organisme ===
const box1H = 150;
doc.rect(boxLeft, doc.y, contentWidth, box1H).stroke();
const box1Y = doc.y + 6;
doc.fontSize(9).font('Helvetica-Bold').text('1. ORGANISME BENEFICIAIRE', boxInner, box1Y);
doc.moveDown(0.3);
doc.fontSize(8).font('Helvetica');
doc.text(`Nom : ${association.nom}`, boxInner);
doc.text(`Adresse : ${association.adresse}  ${association.codePostal} ${association.ville}`, boxInner);
doc.text(`N\u00B0 SIREN/RNA : ${association.siren}  \u2014  Statut : ${association.statut}`, boxInner);
doc.text(`Objet : ${association.objet}`, boxInner);
doc.moveDown(0.2);
doc.fontSize(7).font('Helvetica-Bold').text('Categorie au regard de l\'article 200 du CGI :', boxInner);
doc.font('Helvetica');
doc.text('[  ] Oeuvre ou organisme d\'interet general   [  ] Fondation ou association reconnue d\'utilite publique', boxInner);
doc.text('[  ] Fondation d\'entreprise   [  ] Etablissement d\'enseignement superieur ou artistique', boxInner);
doc.text('[X] Association cultuelle ou de bienfaisance autorisee a recevoir des dons et legs', boxInner);
doc.y = box1Y + box1H + 4;

// === CADRE 2 : Donateur ===
const box2H = 70;
doc.rect(boxLeft, doc.y, contentWidth, box2H).stroke();
const box2Y = doc.y + 6;
doc.fontSize(9).font('Helvetica-Bold').text('2. DONATEUR (Particulier)', boxInner, box2Y);
doc.moveDown(0.2);
doc.fontSize(8).font('Helvetica');
doc.text('Nom : DUPONT   Prenom : Jean', boxInner);
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
doc.text('Montant : 50.00 \u20AC', boxInner);
doc.font('Helvetica').fontSize(8);
doc.text('Soit en toutes lettres : cinquante euros', boxInner);
doc.moveDown(0.2);
doc.text('Nature du don : Don en numeraire', boxInner);
doc.moveDown(0.2);
doc.text('Forme du don :   [  ] Acte authentique   [  ] Acte sous seing prive   [X] Don manuel   [  ] Autres', boxInner);
doc.y = box3Y + box3H + 4;

// === CADRE 4 : Dispositif ===
const box4H = 55;
doc.rect(boxLeft, doc.y, contentWidth, box4H).stroke();
const box4Y = doc.y + 6;
doc.fontSize(9).font('Helvetica-Bold').text('4. DISPOSITIF LEGAL APPLICABLE', boxInner, box4Y);
doc.moveDown(0.2);
doc.fontSize(7).font('Helvetica');
doc.text('Le beneficiaire certifie sur l\'honneur que les dons et versements qu\'il recoit ouvrent droit a la reduction d\'impot prevue a l\'article :', boxInner);
doc.moveDown(0.2);
doc.fontSize(9).font('Helvetica');
doc.text('[X] 200 du CGI (impot sur le revenu)     [  ] 978 du CGI (IFI \u2014 impot sur la fortune immobiliere)', boxInner);
doc.y = box4Y + box4H + 4;

console.log('Y after box4:', doc.y);

// === Mentions legales ===
doc.moveDown(0.2);
doc.fontSize(7).font('Helvetica');
doc.text(
  'Ce don ouvre droit a une reduction d\'impot sur le revenu egale a 66% du montant verse, dans la limite de 20% du revenu imposable. Si le montant des dons depasse cette limite, l\'excedent est reporte sur les 5 annees suivantes.',
  boxLeft, doc.y, { width: contentWidth, align: 'justify' }
);

// === PHRASE ABSENCE CONTREPARTIE ===
doc.moveDown(0.2);
doc.fontSize(7).font('Helvetica-Oblique').fillColor('#333333');
doc.text(
  'Le don a ete effectue sans aucune contrepartie directe ou indirecte au profit du donateur.',
  boxLeft, doc.y, { width: contentWidth, align: 'center' }
);
doc.font('Helvetica').fillColor('#000000');

console.log('Y after contrepartie:', doc.y);

// === BLOC SIGNATURE (bas-droite, position fixe) ===
const sigBlockX = contentRight - 200;
const sigBlockY = 610;

doc.fontSize(9).font('Helvetica');
doc.text(`Fait a ${association.ville}, le 16/02/2026`, sigBlockX, sigBlockY, { width: 200, align: 'right' });
doc.moveDown(0.3);
doc.text(association.signataire, sigBlockX, doc.y, { width: 200, align: 'right' });
doc.text(association.nomSignataire, sigBlockX, doc.y, { width: 200, align: 'right' });

console.log('Y after signature:', doc.y);

// === CACHET REEL (image depuis backoffice) ===
const cachetY = doc.y + 4;
const cachetX = contentRight - 140;
const cachetSize = 100;

if (fs.existsSync(cachetPath)) {
  try {
    doc.image(cachetPath, cachetX, cachetY, { width: cachetSize, height: cachetSize });
    console.log('Cachet IMAGE charge depuis:', cachetPath);
  } catch (e) {
    console.error('Erreur cachet:', e.message);
  }
} else {
  console.log('PAS DE CACHET IMAGE - fallback simule');
}

console.log('Cachet bottom:', cachetY + cachetSize);

// === FOOTER ===
doc.fontSize(6).font('Helvetica').text(
  'Document a conserver. Il vous permet de beneficier d\'une reduction d\'impot. Ne pas joindre a la declaration de revenus.',
  boxLeft, 790, { align: 'center', width: contentWidth }
);

doc.end();

stream.on('finish', () => {
  const stats = fs.statSync(outputPath);
  console.log(`\nPDF genere: ${outputPath} (${stats.size} bytes)`);
  console.log('Open with: open test_cerfa_final.pdf');
});
