const axios = require('axios');

async function checkStats() {
    try {
        const response = await axios.get('http://localhost:8081/api/dashboard/stats');
        console.log('API Response:', JSON.stringify(response.data, null, 2));
    } catch (error) {
        console.error('Error fetching stats:', error.message);
    }
}

checkStats();
