const sqlite3 = require('sqlite3').verbose()
const db = new sqlite3.Database('kurssit.db')
const prompt = require('prompt-sync')()
const LINE_PADDING = 20
const OPTIONS_TEXT = `Valitse joku seuraavista:
1. Laske annettuna vuonna saatujen opintopisteiden yhteismäärä.
2. Tulosta annetun opiskelijan kaikki suoritukset aikajärjestyksessä.
3. Tulosta annetun kurssin suoritusten arvosanojen jakauma.
4. Tulosta top x eniten opintopisteitä antaneet opettajat.
5. Sulje ohjelma.`

const promptWithNumberAnswer = (question, min, max) => {
  let answer

  while (typeof answer !== 'number') {
    console.log(question)
    let input = parseInt(prompt('>'))
    
    if (input && input >= min && input <= max) {
      answer = input
    } else {
      console.error(`Valintasi täytyy olla numero, jonka arvo on ${min} - ${max}.`)
    }
  }

  return answer
}

const promptWithStringAnswer = (question, ...options) => {
  console.log(question)
  let answer = prompt('>')
  
  while (options.length !== 0 && !options.includes(answer)) {
    console.log('Valintasi täytyy olla jokin seuraavista:', options)
    answer = prompt('>')
  }

  return answer
}

const countEarnedStudyPointsTotalOfGivenYear = async () => {
  const year = promptWithNumberAnswer('Miltä vuodelta haluaisit nähdä tulokset?', 1, new Date().getFullYear())
  const statement = `
    SELECT SUM(Kurssit.laajuus)
    FROM Kurssit
    LEFT JOIN Suoritukset
    ON Suoritukset.kurssi_id = Kurssit.id
    WHERE Suoritukset.paivays LIKE '%${year}%'
  `
  
  const result = await getResultFromQuery(statement)
  console.log('Opintopisteiden määrä:', result['SUM(Kurssit.laajuus)'])

  const input = promptWithStringAnswer('Haluatko kokeilla jotain toista vuotta? (k/e)', 'k', 'e')

  if (input === 'k') {
    await countEarnedStudyPointsTotalOfGivenYear()
  } else {
    await loop()
  }
}

const printStudentCompletedCoursesOrderedByCompletionDate = async () => {
  const name = promptWithStringAnswer('Kenen suoritukset haluaisit listata?')
  const statement = `
    SELECT K.nimi, K.laajuus, S.paivays, S.arvosana
    FROM Opiskelijat O
    LEFT JOIN Suoritukset S
      ON S.opiskelija_id = O.id
    LEFT JOIN Kurssit K
      ON S.kurssi_id = K.id
    WHERE O.nimi = '${name}'
    ORDER BY S.paivays
  `
  const results = await getResultsFromQuery(statement)

  if (results?.length > 0) {
    console.log(
      'KURSSI'.padEnd(LINE_PADDING),
      'OP. PISTEET'.padEnd(LINE_PADDING),
      'PÄIVÄYS'.padEnd(LINE_PADDING),
      'ARVOSANA'.padEnd(LINE_PADDING))
  
    for (let row of results) {
      console.log(
        row.nimi.padEnd(LINE_PADDING),
        row.laajuus.toString().padEnd(LINE_PADDING),
        row.paivays.padEnd(LINE_PADDING),
        row.arvosana.toString().padEnd(LINE_PADDING))
    }
  } else {
    console.log('Haku ehdolle ei löytyny suorituksia.')
  }

  const input = promptWithStringAnswer('Haluatko nähdä jonkun toisen oppilaan suoritukset? (k/e)', 'k', 'e')

  if (input === 'k') {
    await printStudentCompletedCoursesOrderedByCompletionDate()
  } else {
    await loop()
  }
}

const printCourseGradeDivide = async () => {
  const name = promptWithStringAnswer('Minkä kurssin arvosana jakauman haluaisit tietää?')
  const statement = `
    SELECT COUNT(*)
    FROM Kurssit K LEFT JOIN Suoritukset S ON S.kurssi_id = K.id
    WHERE K.nimi = '${name}'
    GROUP BY S.arvosana
  `
  const results = await getResultsFromQuery(statement)
  
  if (results?.length > 0) {
    for (let i = 0; i < results?.length ?? 0; i++) {
      console.log(`Arvosana ${i + 1}: ${results[i]['COUNT(*)']?.toString()} kpl`)
    }
  } else {
    console.log('Kurssia ei löytynyt.')
  }

  const input = promptWithStringAnswer('Haluatko nähdä jonkun toisen kurssin jakauman? (k/e)', 'k', 'e')

  if (input === 'k') {
    await printCourseGradeDivide()
  } else {
    await loop()
  }
}

const printTopTeachersByGrantedStudyPoints = async () => {
  const limit = promptWithNumberAnswer('Kuinka monta opettajaa haluat listata?', 1, 1000)
  const statement = `
    SELECT O.nimi,  SUM(K.laajuus)
    FROM Opettajat O
    LEFT JOIN Kurssit K
      ON K.opettaja_id = O.id
    LEFT JOIN Suoritukset S
      ON S.kurssi_id = K.id
    GROUP BY O.nimi
    ORDER BY SUM(K.laajuus)
    DESC
    LIMIT ${limit}
  `
  const results = await getResultsFromQuery(statement)

  if (results?.length > 0) {
    console.log('OPETTAJA'.padEnd(LINE_PADDING), 'OP. PISTEET'.padEnd(LINE_PADDING))
    for (let row of results) {
      console.log(row.nimi.padEnd(LINE_PADDING), row['SUM(K.laajuus)']?.toString().padEnd(LINE_PADDING))
    }
  } else {
    console.log('Tuloksia ei löytynyt.')
  }

  const input = promptWithStringAnswer('Haluatko nähdä eri määrän tuloksia? (k/e)', 'k', 'e')

  if (input === 'k') {
    await printTopTeachersByGrantedStudyPoints()
  } else {
    await loop()
  }
}

const getResultsFromQuery = async (statementText) => {
  let result = null
  
  console.log('Fetching results from the database now, this might take a moment.')

  await new Promise(resolve => {
    db.all(statementText, (error, rows) => {
      if (error) {
        console.error(error)
      }

      result = rows
      resolve()
    })
  })

  return result
}

const getResultFromQuery = async (statementText) => {
  let result = null

  console.log('Fetching result from the database now, this might take a moment.')

  await new Promise(resolve => {
    db.get(statementText, (error, value) => {
      if (error) {
        console.error(error)
      }

      result = value
      resolve()
    })
  })

  return result
}

const loop = async () => {
  const input = promptWithNumberAnswer(OPTIONS_TEXT, 1, 5)

  switch (input) {
    case 1:
      await countEarnedStudyPointsTotalOfGivenYear()
      break
    case 2:
      await printStudentCompletedCoursesOrderedByCompletionDate()
      break
    case 3:
      await printCourseGradeDivide()
      break
    case 4:
      await printTopTeachersByGrantedStudyPoints()
      break
    case 5:
      console.log('Kiitos käynnistä, tervetuloa uudelleen!')
      db.close()
      break
  } 
}

loop()