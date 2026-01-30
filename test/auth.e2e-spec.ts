
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { AuthService } from './../src/modules/auth/auth.service';

describe('AuthController (e2e)', () => {
    let app: INestApplication;
    let authService: AuthService;

    const mockAuthService = {
        login: jest.fn(() => {
            return Promise.resolve({
                user: { id: 1, email: 'test@example.com' },
                access_token: 'mock_token',
            });
        }),
        validateUser: jest.fn(),
    };

    beforeAll(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [AppModule],
        })
            .overrideProvider(AuthService)
            .useValue(mockAuthService)
            .compile();

        app = moduleFixture.createNestApplication();
        app.setGlobalPrefix('api');
        app.useGlobalPipes(new ValidationPipe({
            whitelist: true,
            transform: true,
            transformOptions: { enableImplicitConversion: true },
        }));
        await app.init();
        authService = moduleFixture.get<AuthService>(AuthService);
    });

    afterAll(async () => {
        await app.close();
    });

    it('/api/auth/login (POST) - success', () => {
        return request(app.getHttpServer())
            .post('/api/auth/login')
            .send({ email: 'test@example.com', password: 'password' })
            .expect(201)
            .expect((res) => {
                expect(res.body).toHaveProperty('access_token');
                expect(res.body.access_token).toBe('mock_token');
            });
    });

    it('/api/auth/login (POST) - validation fail', () => {
        return request(app.getHttpServer())
            .post('/api/auth/login')
            .send({ email: 'invalid-email' }) // Missing password
            .expect(400);
    });
});
