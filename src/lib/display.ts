const CHONGQING_DISTRICTS = [
  "渝中区",
  "江北区",
  "南岸区",
  "九龙坡区",
  "沙坪坝区",
  "渝北区",
  "大渡口区",
  "巴南区",
  "北碚区",
];

export function normalizeRegion(region: string) {
  const district = CHONGQING_DISTRICTS.find((item) => region.includes(item));
  return district || region.split(/[，,、/]/)[0]?.trim() || region;
}

export function splitCategory(category: string) {
  return category
    .split(/[，,、/]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function normalizeCategory(category: string) {
  return splitCategory(category)[0] || category;
}
