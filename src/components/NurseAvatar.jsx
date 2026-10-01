import { memo } from 'react'
import nurseCurt from '../assets/images/nurse-curt.jpg'

const NurseAvatar = memo(function NurseAvatar({ alt = 'Nurse Curt Cuvin', className = '', src = '' }) {
  return <img src={src || nurseCurt} alt={alt} className={className} />
})

export default NurseAvatar
