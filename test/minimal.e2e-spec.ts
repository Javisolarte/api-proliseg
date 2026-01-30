import { Test, TestingModule } from '@nestjs/testing';
import { Controller, Get, INestApplication, Module } from '@nestjs/common';
import request from 'supertest';

@Controller('minimal')
class MinimalController {
    @Get()
    getHello() {
        return 'Hello Minimal';
    }
}

@Module({
    controllers: [MinimalController],
})
class MinimalModule { }

describe('Minimal (e2e)', () => {
    let app: INestApplication;

    beforeEach(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [MinimalModule],
        }).compile();

        app = moduleFixture.createNestApplication();
        await app.init();
    });

    afterEach(async () => {
        await app.close();
    });

    it('/minimal (GET)', () => {
        return request(app.getHttpServer())
            .get('/minimal')
            .expect(200)
            .expect('Hello Minimal');
    });
});
