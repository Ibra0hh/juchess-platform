export type JordanUniversityGroup = {
  label: string
  universities: readonly string[]
}

export const OTHER_UNIVERSITY_VALUE = '__other_university__'

// Jordan Ministry of Higher Education directory, checked 2026-07-13.
export const JORDAN_UNIVERSITY_GROUPS: readonly JordanUniversityGroup[] = [
  {
    label: 'Public universities',
    universities: [
      'University of Jordan',
      'Yarmouk University',
      'Mutah University',
      'Jordan University of Science and Technology',
      'Hashemite University',
      'Al al-Bayt University',
      'Al-Balqa Applied University',
      'Al-Hussein Bin Talal University',
      'Tafila Technical University',
      'German Jordanian University',
    ],
  },
  {
    label: 'Private universities',
    universities: [
      'Jordan Islamic University',
      'Al-Ahliyya Amman University',
      'Applied Science Private University',
      'Philadelphia University',
      'Al-Israa University',
      'University of Petra',
      'Al-Zaytoonah University of Jordan',
      'Jerash University',
      'Irbid National University',
      'Zarqa University',
      'Princess Sumaya University for Technology',
      'Amman Arab University',
      'Middle East University',
      'Jadara University',
      'American University of Madaba',
      'Ajloun National University',
      'Aqaba University of Technology',
      'Aqaba Medical Sciences University',
      'Ibn Sina University for Medical Sciences',
    ],
  },
  {
    label: 'Special-law universities',
    universities: [
      'World Islamic Sciences and Education University',
      'Al-Hussein Technical University',
    ],
  },
  {
    label: 'Regional universities',
    universities: [
      'Arab Open University - Jordan',
    ],
  },
] as const

export const JORDAN_UNIVERSITIES = JORDAN_UNIVERSITY_GROUPS.flatMap((group) => group.universities)

export function isListedJordanUniversity(value: string) {
  return JORDAN_UNIVERSITIES.includes(value)
}
