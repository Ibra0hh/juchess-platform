import { useEffect, useId, useState } from 'react'
import {
  isListedJordanUniversity,
  JORDAN_UNIVERSITY_GROUPS,
  OTHER_UNIVERSITY_VALUE,
} from '../lib/jordanUniversities'

type UniversityFieldProps = {
  disabled?: boolean
  help?: string
  onChange: (value: string) => void
  required?: boolean
  value: string
}

export default function UniversityField({
  disabled = false,
  help,
  onChange,
  required = false,
  value,
}: UniversityFieldProps) {
  const id = useId()
  const [usingOther, setUsingOther] = useState(() => Boolean(value && !isListedJordanUniversity(value)))
  const selectedValue = usingOther
    ? OTHER_UNIVERSITY_VALUE
    : isListedJordanUniversity(value) ? value : ''

  useEffect(() => {
    if (value) setUsingOther(!isListedJordanUniversity(value))
  }, [value])

  function handleSelection(nextValue: string) {
    if (nextValue === OTHER_UNIVERSITY_VALUE) {
      setUsingOther(true)
      onChange('')
      return
    }

    setUsingOther(false)
    onChange(nextValue)
  }

  return (
    <label className="university-field" htmlFor={id}>
      <span>University{!required ? <em> (optional)</em> : null}</span>
      <select
        id={id}
        name="university"
        autoComplete="organization"
        disabled={disabled}
        onChange={(event) => handleSelection(event.target.value)}
        required={required}
        value={selectedValue}
      >
        <option value="" disabled>Select your university</option>
        {JORDAN_UNIVERSITY_GROUPS.map((group) => (
          <optgroup key={group.label} label={group.label}>
            {group.universities.map((university) => (
              <option key={university} value={university}>{university}</option>
            ))}
          </optgroup>
        ))}
        <option value={OTHER_UNIVERSITY_VALUE}>Other university</option>
      </select>
      {usingOther ? (
        <input
          aria-label="University name"
          autoComplete="organization"
          disabled={disabled}
          maxLength={160}
          name="university"
          onChange={(event) => onChange(event.target.value)}
          placeholder="Type your university name"
          required={required}
          value={value}
        />
      ) : null}
      {help ? <small>{help}</small> : null}
    </label>
  )
}
