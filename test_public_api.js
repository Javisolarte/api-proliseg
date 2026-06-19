const axios = require('axios');

async function run() {
  const token = 'da6d7b8e15f48e003afbff7c8f6bbcef6f7bdfb8bb3e9f910df21deea6c1fa88';
  const url = `https://api.proliseg.com/api/api/public/cotizaciones/${token}`;
  console.log(`Requesting URL: ${url}`);
  try {
    const res = await axios.get(url);
    console.log(`Success! Status: ${res.status}`);
    console.log(`Data keys: ${Object.keys(res.data)}`);
  } catch (err) {
    if (err.response) {
      console.log(`Error! Status: ${err.response.status}`);
      console.log(`Message:`, err.response.data);
    } else {
      console.log(`Error message: ${err.message}`);
    }
  }
}

run().catch(console.error);

