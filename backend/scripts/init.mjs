import {openDatabase} from '../src/config/database.js';
const db=await openDatabase();try{await db.initialize();console.log('Đã khởi tạo 36 bảng QLSV và các bảng mở rộng. Driver:',db.driver);}finally{await db.close();}
