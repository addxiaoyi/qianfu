
async function testApi() {
  const url = 'http://127.0.0.1:3000/api/public/servers?page=1&limit=10';
  console.log(`Fetching ${url}...`);
  try {
    const res = await fetch(url);
    console.log(`Status: ${res.status} ${res.statusText}`);
    console.log(`Content-Type: ${res.headers.get('content-type')}`);
    
    const text = await res.text();
    console.log('Body start:', text.substring(0, 200));
    
    try {
      JSON.parse(text);
      console.log('Body is valid JSON');
    } catch (e) {
      console.log('Body is NOT valid JSON');
    }
  } catch (err) {
    console.error('Fetch error:', err);
  }
}

testApi();
