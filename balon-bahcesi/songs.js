/* BALON BAHÇESİ — şarkılar.
 * Hepsi kamu malı ezgiler ya da oyun için yazılmış özgün melodiler.
 * Notalar bilimsel perde gösterimiyle (C4 = orta Do). Her dokunuş bir sonraki notayı çalar.
 */
window.BALON_SONGS = [
  {
    id: 'twinkle', name: 'Parla Parla Küçük Yıldız', origin: 'Fransız halk ezgisi', price: 0,
    notes: 'C4 C4 G4 G4 A4 A4 G4 F4 F4 E4 E4 D4 D4 C4 G4 G4 F4 F4 E4 E4 D4 G4 G4 F4 F4 E4 E4 D4 C4 C4 G4 G4 A4 A4 G4 F4 F4 E4 E4 D4 D4 C4',
  },
  {
    id: 'frere', name: 'Uyuyor musun?', origin: 'Fransız halk şarkısı (Frère Jacques)', price: 0,
    notes: 'C4 D4 E4 C4 C4 D4 E4 C4 E4 F4 G4 E4 F4 G4 G4 A4 G4 F4 E4 C4 G4 A4 G4 F4 E4 C4 C4 G3 C4 C4 G3 C4',
  },
  {
    id: 'mary', name: 'Küçük Kuzu', origin: 'Amerikan çocuk şarkısı (Mary Had a Little Lamb)', price: 0,
    notes: 'E4 D4 C4 D4 E4 E4 E4 D4 D4 D4 E4 G4 G4 E4 D4 C4 D4 E4 E4 E4 E4 D4 D4 E4 D4 C4',
  },
  {
    id: 'bahce', name: 'Bahçe Valsi', origin: 'Özgün beste', price: 15,
    notes: 'E4 G4 A4 G4 E4 D4 C4 D4 E4 G4 E4 D4 E4 G4 A4 C5 A4 G4 E4 G4 A4 G4 E4 D4 C5 A4 G4 E4 G4 A4 C5 D5 C5 A4 G4 E4 D4 E4 G4 A4 G4 E4 D4 E4 C4',
  },
  {
    id: 'london', name: 'Londra Köprüsü', origin: 'İngiliz halk şarkısı', price: 20,
    notes: 'G4 A4 G4 F4 E4 F4 G4 D4 E4 F4 E4 F4 G4 G4 A4 G4 F4 E4 F4 G4 D4 G4 E4 C4',
  },
  {
    id: 'row', name: 'Kürek Çek', origin: 'Amerikan halk şarkısı (Row, Row, Row Your Boat)', price: 20,
    notes: 'C4 C4 C4 D4 E4 E4 D4 E4 F4 G4 C5 C5 C5 G4 G4 G4 E4 E4 E4 C4 C4 C4 G4 F4 E4 D4 C4',
  },
  {
    id: 'yagmur', name: 'Yağmur Damlaları', origin: 'Özgün beste', price: 25,
    notes: 'A4 C5 D5 C5 A4 G4 A4 C5 G4 E4 D4 E4 G4 A4 G4 E4 D4 E4 G4 A4 C5 A4 G4 E4 D4 C4 D4 E4 G4 E4 D4 C4',
  },
  {
    id: 'ode', name: 'Neşeye Övgü', origin: 'Beethoven, 9. Senfoni (1824)', price: 30,
    notes: 'E4 E4 F4 G4 G4 F4 E4 D4 C4 C4 D4 E4 E4 D4 D4 E4 E4 F4 G4 G4 F4 E4 D4 C4 C4 D4 E4 D4 C4 C4 D4 D4 E4 C4 D4 E4 F4 E4 C4 D4 E4 F4 E4 D4 C4 D4 G3 E4 E4 F4 G4 G4 F4 E4 D4 C4 C4 D4 E4 D4 C4 C4',
  },
  {
    id: 'jingle', name: 'Kızak Zilleri', origin: 'James Lord Pierpont (1857)', price: 30,
    notes: 'E4 E4 E4 E4 E4 E4 E4 G4 C4 D4 E4 F4 F4 F4 F4 F4 E4 E4 E4 E4 D4 D4 E4 D4 G4 E4 E4 E4 E4 E4 E4 E4 G4 C4 D4 E4 F4 F4 F4 F4 F4 E4 E4 E4 G4 G4 F4 D4 C4',
  },
  {
    id: 'brahms', name: 'Brahms Ninnisi', origin: 'Johannes Brahms (1868)', price: 35,
    notes: 'E4 E4 G4 E4 E4 G4 E4 G4 C5 B4 A4 A4 G4 D4 E4 F4 D4 D4 E4 F4 D4 F4 B4 A4 G4 B4 C5 C4 C4 C5 A4 F4 G4 E4 C4 F4 G4 A4 G4 C4 C4 C5 A4 F4 G4 E4 C4 F4 E4 D4 C4',
  },
  {
    id: 'greensleeves', name: 'Yeşil Kollar', origin: 'İngiliz halk ezgisi (Greensleeves, 16. yy)', price: 40,
    notes: 'A4 C5 D5 E5 F5 E5 D5 B4 G4 A4 B4 C5 A4 A4 G#4 A4 B4 G#4 E4 A4 C5 D5 E5 F5 E5 D5 B4 G4 A4 B4 C5 B4 A4 G#4 F#4 G#4 A4 A4 G5 G5 F#5 E5 D5 B4 G4 A4 B4 C5 A4 A4 G#4 A4 B4 G#4 E4 G5 G5 F#5 E5 D5 B4 G4 A4 B4 C5 B4 A4 G#4 F#4 G#4 A4 A4',
  },
];
