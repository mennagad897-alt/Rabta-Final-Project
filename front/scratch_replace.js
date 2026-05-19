const fs = require('fs');
const p = 'd:/Projects/Rabta-Project/Rabta-Project/front/src/pages/EditProfile.tsx';
let c = fs.readFileSync(p, 'utf8');

c = c.replace(/import \{ uploadProfilePicture \} from '\.\.\/api\/auth';/, `import { uploadProfilePicture, updateMyProfileData } from '../api/auth';`);

c = c.replace(/const handleSubmit = \(e: React\.FormEvent\) => \{\s*e\.preventDefault\(\);\s*dispatch\(updateProfile\(formData\)\);\s*setShowSuccessPopup\(true\);\s*};\s*/, `const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        about: formData.detailedAbout
      };
      const updatedUser = await updateMyProfileData(payload);
      dispatch(updateProfile(updatedUser));
      setShowSuccessPopup(true);
    } catch (error) {
      console.error(error);
    }
  };\n\n  `);

const t = 'w-full bg-[#2A2A2E] border border-zinc-700 rounded-md px-3 py-2 text-white focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500';

c = c.replace(/className="input-field([^"]*)"/g, 'className="' + t + '$1"');
c = c.replace(/\.input-field \{ [^\}]+\}/g, '');

fs.writeFileSync(p, c);
