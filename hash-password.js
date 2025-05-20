const bcrypt = require('bcrypt');
const fs = require('fs');

async function hashPassword(password) {
  const saltRounds = 10;
  const hash = await bcrypt.hash(password, saltRounds);
  console.log('Hashed password:', hash);
  return hash;
}

// 「576cosmo」をハッシュ化
hashPassword('576cosmo').then(hash => {
  console.log('Use this hash in schools.json');
}); 