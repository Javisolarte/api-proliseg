import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';

describe('HealthController (e2e)', () => {
    let app: INestApplication;

    beforeAll(async () => {
        try {
            const moduleFixture: TestingModule = await Test.createTestingModule({
                imports: [AppModule],
            }).compile();

            app = moduleFixture.createNestApplication();
            app.setGlobalPrefix('api');
            await app.init();
        } catch (e) {
            console.error('Test Init Error:', e);
            throw e;
        }
    });

    afterAll(async () => {
        await app.close();
    });

    it('/api/health (GET)', () => {
        return request(app.getHttpServer())
            .get('/api/health')
            .expect((res) => {
                if (res.status !== 200) {
                    require('fs').writeFileSync('test/test_health_error.json', JSON.stringify(res.body, null, 2));
                }
            })
            .expect(200)
            .expect((res) => {
                expect(res.body).toHaveProperty('status', 'ok');
                expect(res.body).toHaveProperty('info');
                expect(res.body).toHaveProperty('details');
            });
    });

    it('/api/health/db (GET)', () => {
        return request(app.getHttpServer())
            .get('/api/health/db')
            .expect(200)
            .expect((res) => {
                expect(res.body).toHaveProperty('status');
                expect(res.body.info).toHaveProperty('database_proxy');
            });
    });
});
