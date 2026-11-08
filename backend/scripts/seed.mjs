import {openDatabase} from '../src/config/database.js';import {seedDemo} from '../database/seeds/demo.seed.js';
const db=await openDatabase();try{await db.initialize();await seedDemo(db);console.log('Dữ liệu mẫu sẵn sàng. Chỉ dùng cho môi trường phát triển.');}finally{await db.close();}
