/* Drift Garden — songs.
 * Public-domain works and traditional melodies, plus two originals written for the game.
 * Notes use scientific pitch (C4 = middle C). `drone` is the root note played softly underneath.
 */
window.DRIFT_SONGS = [
  {
    id: 'ode', price: 0, drone: 'C3',
    name: { en: 'Ode to Joy', tr: 'Neşeye Övgü' },
    origin: { en: 'Beethoven, Symphony No. 9 (1824)', tr: 'Beethoven, 9. Senfoni (1824)' },
    notes: 'E4 E4 F4 G4 G4 F4 E4 D4 C4 C4 D4 E4 E4 D4 D4 E4 E4 F4 G4 G4 F4 E4 D4 C4 C4 D4 E4 D4 C4 C4 D4 D4 E4 C4 D4 E4 F4 E4 C4 D4 E4 F4 E4 D4 C4 D4 G3 E4 E4 F4 G4 G4 F4 E4 D4 C4 C4 D4 E4 D4 C4 C4',
  },
  {
    id: 'grace', price: 0, drone: 'G2',
    name: { en: 'Amazing Grace', tr: 'Amazing Grace' },
    origin: { en: 'Traditional hymn (1835)', tr: 'Geleneksel ilahi (1835)' },
    notes: 'D4 G4 B4 A4 G4 B4 A4 G4 E4 D4 D4 G4 B4 A4 G4 B4 A4 D5 B4 D5 B4 D5 B4 G4 D4 E4 G4 E4 D4 D4 G4 B4 A4 G4 B4 A4 G4',
  },
  {
    id: 'scarborough', price: 0, drone: 'D3',
    name: { en: 'Scarborough Fair', tr: 'Scarborough Fair' },
    origin: { en: 'Traditional English ballad', tr: 'Geleneksel İngiliz baladı' },
    notes: 'D4 D4 A4 A4 E4 F4 E4 D4 A4 C5 D5 C5 A4 B4 G4 A4 D5 D5 D5 C5 A4 A4 G4 F4 E4 D4 C4 D4 A4 G4 F4 E4 D4 C4 D4',
  },
  {
    id: 'evening', price: 15, drone: 'C3',
    name: { en: 'Evening Waltz', tr: 'Akşam Valsi' },
    origin: { en: 'Original', tr: 'Özgün beste' },
    notes: 'E4 G4 A4 G4 E4 D4 C4 D4 E4 G4 E4 D4 E4 G4 A4 C5 A4 G4 E4 G4 A4 G4 E4 D4 C5 A4 G4 E4 G4 A4 C5 D5 C5 A4 G4 E4 D4 E4 G4 A4 G4 E4 D4 E4 C4',
  },
  {
    id: 'morning', price: 20, drone: 'C3',
    name: { en: 'Morning Mood', tr: 'Sabah' },
    origin: { en: 'Grieg, Peer Gynt (1875)', tr: 'Grieg, Peer Gynt (1875)' },
    notes: 'G4 E4 D4 C4 D4 E4 G4 E4 D4 C4 D4 E4 D4 E4 G4 E4 G4 A4 E4 A4 G4 E4 D4 C4 G4 E4 D4 C4 D4 E4 G4 E4 D4 C4 D4 E4 D4 E4 G4 E4 G4 A4 E4 A4 G4 E4 D4 C4',
  },
  {
    id: 'minuet', price: 20, drone: 'G2',
    name: { en: 'Minuet in G', tr: 'Sol Majör Minuet' },
    origin: { en: 'Christian Petzold (c. 1725)', tr: 'Christian Petzold (yak. 1725)' },
    notes: 'D5 G4 A4 B4 C5 D5 G4 G4 E5 C5 D5 E5 F#5 G5 G4 G4 C5 D5 C5 B4 A4 B4 C5 B4 A4 G4 F#4 G4 A4 B4 G4 A4',
  },
  {
    id: 'rain', price: 25, drone: 'A2',
    name: { en: 'Rain on Glass', tr: 'Camdaki Yağmur' },
    origin: { en: 'Original', tr: 'Özgün beste' },
    notes: 'A4 C5 D5 C5 A4 G4 A4 C5 G4 E4 D4 E4 G4 A4 G4 E4 D4 E4 G4 A4 C5 A4 G4 E4 D4 C4 D4 E4 G4 E4 D4 C4',
  },
  {
    id: 'largo', price: 25, drone: 'C3',
    name: { en: 'Going Home', tr: 'Eve Dönüş' },
    origin: { en: 'Dvořák, New World Symphony (1893)', tr: 'Dvořák, Yeni Dünya Senfonisi (1893)' },
    notes: 'E4 G4 G4 E4 D4 C4 D4 E4 G4 E4 D4 E4 G4 G4 E4 D4 C4 D4 E4 D4 C4 C4 E4 G4 G4 E4 D4 C4 D4 E4 G4 E4 D4 E4 G4 G4 E4 D4 C4 D4 E4 D4 C4 C4',
  },
  {
    id: 'greensleeves', price: 30, drone: 'A2',
    name: { en: 'Greensleeves', tr: 'Greensleeves' },
    origin: { en: 'Traditional English (16th c.)', tr: 'Geleneksel İngiliz (16. yy)' },
    notes: 'A4 C5 D5 E5 F5 E5 D5 B4 G4 A4 B4 C5 A4 A4 G#4 A4 B4 G#4 E4 A4 C5 D5 E5 F5 E5 D5 B4 G4 A4 B4 C5 B4 A4 G#4 F#4 G#4 A4 A4 G5 G5 F#5 E5 D5 B4 G4 A4 B4 C5 A4 A4 G#4 A4 B4 G#4 E4 G5 G5 F#5 E5 D5 B4 G4 A4 B4 C5 B4 A4 G#4 F#4 G#4 A4 A4',
  },
  {
    id: 'elise', price: 35, drone: 'A2',
    name: { en: 'Für Elise', tr: 'Für Elise' },
    origin: { en: 'Beethoven (1810)', tr: 'Beethoven (1810)' },
    notes: 'E5 D#5 E5 D#5 E5 B4 D5 C5 A4 C4 E4 A4 B4 E4 G#4 B4 C5 E4 E5 D#5 E5 D#5 E5 B4 D5 C5 A4 C4 E4 A4 B4 E4 C5 B4 A4',
  },
  {
    id: 'canon', price: 35, drone: 'C3',
    name: { en: 'Canon', tr: 'Kanon' },
    origin: { en: 'Pachelbel (c. 1680)', tr: 'Pachelbel (yak. 1680)' },
    notes: 'E5 D5 C5 B4 A4 G4 A4 B4 C5 B4 A4 G4 F4 E4 F4 D4 E4 D4 C4 B3 A3 G3 A3 B3 C4 B3 A3 G3 F3 E3 F3 G3',
  },
  {
    id: 'brahms', price: 40, drone: 'C3',
    name: { en: "Brahms' Lullaby", tr: 'Brahms Ninnisi' },
    origin: { en: 'Johannes Brahms (1868)', tr: 'Johannes Brahms (1868)' },
    notes: 'E4 E4 G4 E4 E4 G4 E4 G4 C5 B4 A4 A4 G4 D4 E4 F4 D4 D4 E4 F4 D4 F4 B4 A4 G4 B4 C5 C4 C4 C5 A4 F4 G4 E4 C4 F4 G4 A4 G4 C4 C4 C5 A4 F4 G4 E4 C4 F4 E4 D4 C4',
  },
  {
    id: 'auld', price: 40, drone: 'C3',
    name: { en: 'Auld Lang Syne', tr: 'Auld Lang Syne' },
    origin: { en: 'Traditional Scottish', tr: 'Geleneksel İskoç' },
    notes: 'G4 C5 C5 C5 E5 D5 C5 D5 E5 D5 C5 C5 E5 G5 A5 A5 G5 E5 E5 C5 D5 C5 D5 E5 D5 C5 A4 A4 G4 C5',
  },
  {
    id: 'lanterns', price: 15, drone: 'C3',
    name: { en: 'Paper Lanterns', tr: 'Kâğıt Fenerler' },
    origin: { en: 'Original', tr: 'Özgün beste' },
    notes: 'G4 A4 C5 A4 G4 E4 G4 A4 C5 D5 E5 D5 C5 A4 G4 A4 C5 A4 G4 E4 D4 E4 G4 E4 D4 C4 D4 E4 G4 A4 G4 E4 D4 C4',
  },
  {
    id: 'silent', price: 20, drone: 'C3',
    name: { en: 'Silent Night', tr: 'Sessiz Gece' },
    origin: { en: 'Franz Xaver Gruber (1818)', tr: 'Franz Xaver Gruber (1818)' },
    notes: 'G4 A4 G4 E4 G4 A4 G4 E4 D5 D5 B4 C5 C5 G4 A4 A4 C5 B4 A4 G4 A4 G4 E4 A4 A4 C5 B4 A4 G4 A4 G4 E4 D5 D5 F5 D5 B4 C5 E5 C5 G4 E4 G4 F4 D4 C4',
  },
  {
    id: 'tide', price: 25, drone: 'A2',
    name: { en: 'Low Tide', tr: 'Cezir' },
    origin: { en: 'Original', tr: 'Özgün beste' },
    notes: 'A4 C5 E5 D5 C5 A4 G4 A4 C5 D5 E5 G5 E5 D5 C5 A4 E4 G4 A4 C5 A4 G4 E4 D4 E4 G4 A4',
  },
  {
    id: 'prelude', price: 30, drone: 'C3',
    name: { en: 'Prelude in C', tr: 'Do Majör Prelüd' },
    origin: { en: 'J. S. Bach, Well-Tempered Clavier (1722)', tr: 'J. S. Bach, Well-Tempered Clavier (1722)' },
    notes: 'C4 E4 G4 C5 E5 G4 C5 E5 C4 D4 A4 D5 F5 A4 D5 F5 B3 D4 G4 D5 F5 G4 D5 F5 C4 E4 G4 C5 E5 G4 C5 E5 C4 E4 A4 E5 A5 A4 E5 A5 C4 D4 F#4 A4 D5 F#4 A4 D5 B3 D4 G4 D5 G5 G4 D5 G5 B3 C4 E4 G4 C5 E4 G4 C5',
  },
  {
    id: 'nacht', price: 30, drone: 'G2',
    name: { en: 'Eine kleine Nachtmusik', tr: 'Küçük Bir Gece Müziği' },
    origin: { en: 'Mozart (1787)', tr: 'Mozart (1787)' },
    notes: 'G4 D4 G4 D4 G4 D4 G4 B4 D5 C5 A4 C5 A4 C5 A4 F#4 A4 D4 G4 D4 G4 D4 G4 D4 G4 B4 D5 C5 A4 C5 A4 C5 A4 F#4 A4 G4',
  },
  {
    id: 'snow', price: 35, drone: 'C3',
    name: { en: 'First Snow', tr: 'İlk Kar' },
    origin: { en: 'Original', tr: 'Özgün beste' },
    notes: 'E5 D5 C5 A4 C5 D5 E5 G5 E5 D5 C5 D5 E5 C5 A4 G4 A4 C5 D5 C5 A4 G4 E4 G4 A4 C5',
  },
  {
    id: 'jesu', price: 40, drone: 'G2',
    name: { en: "Jesu, Joy of Man's Desiring", tr: 'Jesu, Joy of Man\'s Desiring' },
    origin: { en: 'J. S. Bach (1723)', tr: 'J. S. Bach (1723)' },
    notes: 'G4 A4 B4 D5 C5 C5 E5 D5 D5 G5 F#5 G5 D5 B4 G4 A4 B4 C5 D5 E5 D5 C5 B4 A4 B4 G4 F#4 G4 A4 D4 F#4 A4 C5 B4 A4 B4 G4',
  },
  {
    id: 'moonlight', price: 45, drone: 'C#3',
    name: { en: 'Moonlight Sonata', tr: 'Ay Işığı Sonatı' },
    origin: { en: 'Beethoven (1801)', tr: 'Beethoven (1801)' },
    notes: 'G#3 C#4 E4 G#3 C#4 E4 G#3 C#4 E4 G#3 C#4 E4 A3 C#4 E4 A3 C#4 E4 A3 D4 F#4 A3 D4 F#4 G#3 B#3 F#4 G#3 C#4 E4 G#3 C#4 D#4 F#3 B#3 D#4 G#3 C#4 E4 G#3 C#4 E4 G#3 C#4 E4 G#3 C#4 E4',
  },
  {
    id: 'train', price: 45, drone: 'D3',
    name: { en: 'Night Train', tr: 'Gece Treni' },
    origin: { en: 'Original', tr: 'Özgün beste' },
    notes: 'D4 E4 G4 A4 G4 E4 D4 C4 D4 E4 G4 A4 C5 A4 G4 E4 G4 A4 C5 D5 C5 A4 G4 E4 D4 E4 G4 E4 D4',
  },
  {
    id: 'turca', price: 50, drone: 'A2',
    name: { en: 'Rondo alla Turca', tr: 'Türk Marşı' },
    origin: { en: 'Mozart, Piano Sonata No. 11 (1783)', tr: 'Mozart, 11. Piyano Sonatı (1783)' },
    notes: 'B4 A4 G#4 A4 C5 D5 C5 B4 C5 E5 F5 E5 D#5 E5 B5 A5 G#5 A5 B5 A5 G#5 A5 C6 A5 C6 B5 A5 G#5 A5 E5 F5 D5 C5 B4 A4',
  },
  {
    id: 'danube', price: 55, drone: 'D3',
    name: { en: 'The Blue Danube', tr: 'Mavi Tuna' },
    origin: { en: 'Johann Strauss II (1866)', tr: 'Johann Strauss II (1866)' },
    notes: 'D4 D4 F#4 A4 A4 A5 A5 F#5 F#5 D4 D4 F#4 A4 A4 B5 B5 G5 G5 C#4 C#4 E4 B4 B4 B5 B5 G5 G5 C#4 C#4 E4 B4 B4 B5 B5 F#5 F#5 D4 D4 F#4 A4 D5 D6 D6 A5 A5 D4 D4 F#4 A4 D5 D6 D6 B5 B5',
  },
  {
    id: 'mountain', price: 60, drone: 'B2',
    name: { en: 'In the Hall of the Mountain King', tr: 'Dağ Kralının Sarayında' },
    origin: { en: 'Grieg, Peer Gynt (1875)', tr: 'Grieg, Peer Gynt (1875)' },
    notes: 'B3 C#4 D4 E4 F#4 D4 F#4 F4 C#4 F4 E4 C4 E4 B3 C#4 D4 E4 F#4 D4 F#4 B4 A4 F#4 D4 F#4 A4 B3 C#4 D4 E4 F#4 D4 F#4 F4 C#4 F4 E4 C4 E4 B3 C#4 D4 E4 F#4 D4 F#4 B4 A4 F#4 D4 F#4 B4',
  },
];
