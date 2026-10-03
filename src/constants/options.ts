export const MBTI_OPTIONS = [
  'ISTJ', 'ISFJ', 'INFJ', 'INTJ',
  'ISTP', 'ISFP', 'INFP', 'INTP',
  'ESTP', 'ESFP', 'ENFP', 'ENTP',
  'ESTJ', 'ESFJ', 'ENFJ', 'ENTJ',
] as const

export const SKIN_TYPES = ['흰 피부', '중간 피부', '그을린 피부'] as const
export const SKIN_TYPES_WITH_ANY = [...SKIN_TYPES, '상관없음'] as const

export const ANIMAL_TYPES = [
  '토끼상', '강아지상', '고양이상', '여우상', '사슴상',
  '곰상', '공룡상', '원숭이상', '늑대상',
] as const
export const ANIMAL_TYPES_WITH_ANY = [...ANIMAL_TYPES, '상관없음'] as const

export const FACE_TYPES = ['두부상', '아랍상'] as const
export const FACE_TYPES_WITH_ANY = [...FACE_TYPES, '상관없음'] as const

// 체형: 선호 상대방 (여자 기준)
export const BODY_TYPES_FEMALE = ['슬림', '보통', '건장', '근육질', '통통', '뚱뚱', '상관없음'] as const

// 체형: 선호 상대방 (남자 기준)
export const BODY_TYPES_MALE = ['슬림', '보통', '근육질', '통통', '뚱뚱', '상관없음'] as const

// 나의 체형: 본인이 남자일 경우
export const SELF_BODY_TYPES_MALE = ['슬림', '보통', '건장', '근육질', '통통', '뚱뚱'] as const

// 나의 체형: 본인이 여자일 경우
export const SELF_BODY_TYPES_FEMALE = ['슬림', '보통', '근육질', '통통', '뚱뚱'] as const

export const PERSONALITY_TRAITS = [
  '착한', '다정한', '배려심 있는', '유머러스한', '대화가 잘 통하는',
  '긍정적인', '책임감 있는', '성실한', '자상한', '활발한',
  '차분한', '리더십 있는', '감정 표현이 좋은', '독립적인', '가족적인',
  '부유한', '자기관리가 철저한', '취미가 잘 맞는', '가치관이 비슷한',
] as const
export const PERSONALITY_TRAITS_WITH_ANY = [...PERSONALITY_TRAITS, '상관없음'] as const

export const GENDER_OPTIONS = [
  { value: '남', label: '남' },
  { value: '여', label: '여' },
] as const
