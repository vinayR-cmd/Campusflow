export interface OnboardingData {
  email: string;
  collegeDomain: string;
  college: string;
  branch: string;
  year: number;
  section: string;
  hostel: string;
  goal: string;
  target_companies: string[];
  skills: string[];
  linkedin_url: string;
  full_name: string;
}

export const BRANCHES = ["CSE", "ECE", "EEE", "ME", "CE", "IT", "Other"];
export const YEARS = [1, 2, 3, 4];
export const SECTIONS = ["A", "B", "C", "D", "Other"];
export const HOSTELS = ["Boys Hostel", "Girls Hostel", "Day Scholar"];
export const GOALS = [
  "Placement",
  "GATE",
  "Higher Studies",
  "Entrepreneurship",
  "Other",
];
export const SKILLS = [
  "DSA",
  "Python",
  "Java",
  "C++",
  "ML/AI",
  "Web Dev",
  "SQL",
  "System Design",
  "Communication",
  "Leadership",
];

export const DEFAULT_ONBOARDING_DATA: OnboardingData = {
  email: "",
  collegeDomain: "",
  college: "",
  branch: BRANCHES[0],
  year: 1,
  section: SECTIONS[0],
  hostel: HOSTELS[0],
  goal: GOALS[0],
  target_companies: [],
  skills: [],
  linkedin_url: "",
  full_name: "",
};
