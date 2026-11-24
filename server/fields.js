// Excel column definitions — the ORDER here is the column order in the sheet.
// Change `header` to match your own Excel template's column titles.
// `list: true` means the value is an array and gets joined with ", ".
export const COLUMNS = [
  { key: 'name', header: 'Name*' },
  { key: 'contactNumber', header: 'Contact Number*' },
  { key: 'email', header: 'Email ID*' },
  { key: 'source', header: 'Source*' },
  { key: 'totalExperience', header: 'Total Experience in years*', numeric: true },
  { key: 'relevantExperience', header: 'Relevant Experience in years*', numeric: true },
  { key: 'skill', header: 'Skill*', list: true },
  { key: 'subSkill', header: 'Sub Skill*', list: true },
  { key: 'communicationSkill', header: 'Communication Skill*' },
  { key: 'noticePeriod', header: 'Notice Period (Months or Days)*' },
  { key: 'education', header: 'Education including Passed Year*' },
  { key: 'currentLocation', header: 'Current Location*' },
  { key: 'preferredLocation', header: 'Preferred Location*' },
  { key: 'currentCTC', header: 'Current CTC*' },
  { key: 'expectedCTC', header: 'Expected CTC*' },
  { key: 'currentCompany', header: 'Current Company*' },
  { key: 'clientsWorked', header: 'Clients Worked*', list: true },
  { key: 'holdingOffers', header: 'Holding Offers & Details*' },
  { key: 'technicalCompetency', header: 'Technical Competency*' },
  { key: 'recruiterComments', header: "Recruiter's Comments and Recommendation*" },
  { key: 'trackingHistory', header: 'Tracking History*' },
  { key: 'resumeFile', header: 'Upload Resume*' },
  { key: 'recruiterName', header: 'Recruiter Name*' },
  { key: 'submissionDate', header: 'Submission Date', date: true },
];
