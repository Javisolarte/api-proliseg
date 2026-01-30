import http from 'k6/http';
import { check, sleep } from 'k6';

export let options = {
    stages: [
        { duration: '30s', target: 20 }, // subida a 20 usuarios
        { duration: '1m', target: 20 },  // mantener 20 usuarios
        { duration: '30s', target: 0 },  // bajada
    ],
    thresholds: {
        http_req_duration: ['p(95)<500'], // 95% de peticiones < 500ms
    },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:3000';

export default function () {
    // 1. Salud del sistema
    let resHealth = http.get(`${BASE_URL}/api/health`);
    check(resHealth, { 'status is 200': (r) => r.status === 200 });

    // 2. Analítica (Carga pesada)
    let params = {
        headers: {
            'Authorization': `Bearer ${__ENV.TEST_TOKEN}`,
        },
    };

    if (__ENV.TEST_TOKEN) {
        let resBI = http.get(`${BASE_URL}/analytics/cumplimiento-turnos`, params);
        check(resBI, { 'BI status is 200': (r) => r.status === 200 });
    }

    sleep(1);
}
