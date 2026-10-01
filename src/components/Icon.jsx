import { icons } from '../data/constants'

const svgIcons = {
  students: (
    <svg className="svg-icon person-icon" viewBox="0 0 24 24" focusable="false">
      <circle cx="12" cy="8" r="4.5" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M4.5 21a7.5 7.5 0 0 1 15 0Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  ),
  inventory: (
    <svg className="svg-icon capsule-icon" viewBox="0 0 24 24" focusable="false">
      <path d="M8 2a6 6 0 0 0-6 6v8a6 6 0 0 0 6 6h8a6 6 0 0 0 6-6V8a6 6 0 0 0-6-6Z" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <line x1="8" y1="12" x2="16" y2="12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  ),
  eye: (
    <svg className="svg-icon eye-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" focusable="false">
      <path d="M1.5 12S5 5 12 5s10.5 7 10.5 7-3.5 7-10.5 7S1.5 12 1.5 12Z" />
      <circle cx="12" cy="12" r="3.2" />
    </svg>
  ),
  eyeOff: (
    <svg className="svg-icon eye-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" focusable="false">
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 10.5 8 10.5 8a13.28 13.28 0 0 1-2.16 3.19m-3.15 2.36A9.05 9.05 0 0 1 12 20c-7 0-10.5-8-10.5-8a13.34 13.34 0 0 1 3.6-4.85" />
      <path d="M9.53 9.53a3 3 0 0 0 4.24 4.24" />
      <path d="M1.5 1.5 22.5 22.5" />
    </svg>
  ),
  minus: (
    <svg className="svg-icon minus-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" focusable="false">
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  ),
  sun: (
    <svg className="svg-icon theme-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" focusable="false">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2.2M12 19.8V22M4.93 4.93l1.56 1.56M17.51 17.51l1.56 1.56M2 12h2.2M19.8 12H22M4.93 19.07l1.56-1.56M17.51 6.49l1.56-1.56" />
    </svg>
  ),
  moon: (
    <svg className="svg-icon theme-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" focusable="false">
      <path d="M20.4 14.4A8 8 0 0 1 9.6 3.6 8.6 8.6 0 1 0 20.4 14.4Z" />
    </svg>
  ),
}

export default function Icon({ name, className = '' }) {
  return (
    <span className={`icon ${className}`} aria-hidden="true">
      {svgIcons[name] || icons[name]}
    </span>
  )
}
