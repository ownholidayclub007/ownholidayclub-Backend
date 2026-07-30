const mongoose = require('mongoose');

mongoose.connect('mongodb://127.0.0.1:27017/ownholidayclub')
  .then(async () => {
    const user = await mongoose.connection.db.collection('users').findOne({ email: 'vansh.2002vc@gmail.com' });
    console.log(user ? user._id : 'Not found');
    process.exit(0);
  });
