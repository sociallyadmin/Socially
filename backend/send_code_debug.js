const { sendVerificationEmail, generateVerificationCode } = require('./src/email');

(async () => {
  try {
    const code = generateVerificationCode();
    console.log('Generated verification code:', code);
    const sent = await sendVerificationEmail('mason.hain@ccde.us', code);
    console.log('send result', sent);
  } catch (err) {
    console.error('error sending debug code:', err);
  }
})();
