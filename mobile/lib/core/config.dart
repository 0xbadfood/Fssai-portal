// Where the app talks to, and the brand. The API is the portal's own (/api on the deploy server); build with
// --dart-define=API_BASE=https://myfoodlicense.com once that name resolves.
const apiBase = String.fromEnvironment('API_BASE', defaultValue: 'https://mfl.toystech.in');

const brandName = 'MyFoodLicense';
const brandDomain = 'myfoodlicense.com';
const brandTld = '.com';
const brandTagline = 'FSSAI Registration & Licensing Simplified';
const foscosUrl = 'https://foscos.fssai.gov.in';

const trustDisclaimer =
    '$brandDomain is a private compliance-assistance platform and is not affiliated with or an official channel of the '
    'Food Safety and Standards Authority of India (FSSAI). We help you prepare your application; final submission takes '
    "place on the Government's official FoSCoS portal (foscos.fssai.gov.in).";
