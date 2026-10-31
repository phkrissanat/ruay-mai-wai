# RUAY MAI WAI

แอปภาษาไทยสำหรับบันทึกค่าน้ำมัน ใช้บนมือถือผ่าน GitHub Pages และติดตั้งเป็น PWA

## บริการฟรีเท่านั้น

- GitHub repository ต้องเป็น Public ใช้ GitHub Pages และ Actions standard Linux runner
- Firebase ใช้ Spark เท่านั้น ไม่ต้องเปิด Blaze หรือผูกบัตรเพื่อชุดนี้
- ไม่มี Cloud Functions ไม่มีงาน cron ไม่มีระบบอัปเดตราคาตลอดเวลา
- แอปเช็กราคาเมื่อเปิดหรือกลับมาใช้งานเท่านั้น การเปลี่ยนชนิดน้ำมันใช้ข้อมูลชุดเดียวกัน
- สำรอง Firebase เมื่อข้อมูลเปลี่ยน หากส่งไม่สำเร็จเก็บคิวในเครื่องและลองใหม่
- เมื่อเกินโควตาฟรีของบริการ ฟังก์ชันนั้นอาจหยุดทำงาน ชุดนี้ไม่ได้ตั้งให้อัปเกรดเป็นแผนเสียเงิน

## อัปโหลด GitHub และเปิดบนมือถือ

1. สร้าง repository แบบ Public ชื่อ ruay-mai-wai โดยใช้ branch main
2. อัปโหลดเนื้อหาทั้งหมดในโฟลเดอร์นี้ไว้ที่ root รวม .github/workflows และ .firebaserc ห้ามอัปโหลดเฉพาะ ZIP หรือเฉพาะ dist
3. ไป Settings → Pages → Source เลือก GitHub Actions
4. ไป Actions → Publish app → Run workflow หรือ push โค้ดเข้า main
5. เมื่อ workflow ผ่าน เปิด URL ที่ deployment แสดง รูปแบบ https://YOUR-USERNAME.github.io/ruay-mai-wai/
6. Android: เปิด Chrome → เมนู → ติดตั้งแอป / เพิ่มไปยังหน้าจอหลัก
7. iPhone: เปิด Safari → แชร์ → เพิ่มไปยังหน้าจอโฮม

GitHub Actions ทำหน้าที่ตรวจและเผยแพร่โค้ดเฉพาะเมื่อ push หรือสั่งด้วยมือ ไม่ดึงราคาน้ำมันตามเวลา

## ราคาน้ำมันเมื่อเปิดแอป

ตั้งค่าใน dist/price-config.js ค่าเริ่มต้นเป็น API ทางการบางจาก:
https://oil-price.bangchak.co.th/ApiOilPrice2/th

หาก API ไม่อนุญาต CORS จากเว็บไซต์ GitHub Pages ให้ใช้ตัวรับราคาที่เตรียมไว้:

1. สร้าง Cloudflare Worker บน FREE plan ใช้ URL workers.dev ที่ให้มาฟรี
2. วางโค้ด optional-price-proxy/worker.js
3. ตั้งตัวแปร ALLOWED_ORIGIN เป็น https://YOUR-USERNAME.github.io (ไม่มี path และไม่มี slash ท้าย)
4. เปลี่ยน PRICE_ENDPOINT ใน dist/price-config.js เป็น URL workers.dev แล้ว push
5. เปิดแอปใหม่ เลือกชนิดน้ำมัน ตรวจราคา แหล่งที่มา และเวลาอัปเดต

Worker ทำงานเฉพาะเมื่อแอปเรียก ไม่ต้องตั้ง scheduled trigger หากไม่ต้องการใช้ Worker ให้ตรวจว่า API ทางการเปิด CORS ให้โดเมนของคุณจริงก่อน

ไม่มีการรับประกันว่าต้นทางจะตอบได้ทุกครั้ง ราคาอ้างอิงเป็นราคาประกาศบางจากตามขอบเขตของต้นทาง ไม่ใช่ทุกสาขาหรือทุกยี่ห้อ ปริมาณลิตรเป็นค่าคำนวณจากยอดเงิน ไม่รวมความต่างของส่วนลดหรือราคาจ่ายจริง หลังข้อมูลเกิน 15 นาทีต้องเปิด/กลับมาแอปเพื่อรับข้อมูลใหม่จึงบันทึกได้ วันที่มีผลจะแสดงตามต้นทาง ไม่มีการเดาวันที่ใหม่

## Firebase สำรองข้อมูล

โปรเจกต์: ruay-mai-wai-54b5f
- เปิด Anonymous Authentication
- สร้าง Cloud Firestore และใช้ Rules ใน firestore.rules (จำกัดให้อ่าน/เขียนเฉพาะเจ้าของ)
- Firebase web config อยู่ dist/firebase-config.js เป็นค่าฝั่งเว็บ ไม่ใช่ Admin key
- ห้ามอัปโหลด service-account key, refresh token หรือข้อมูลรายการส่วนตัวเข้า GitHub
- สถานะสำรองแล้วแสดงหลังเขียนแล้วอ่านกลับตรวจตรงกัน
- สำรอง cloud ล่าสุดสูงสุดประมาณ 850 KB และสำเนาในเครื่องสูงสุด 5 รุ่นตามพื้นที่ที่มี

สำคัญ: เวอร์ชันทดสอบใช้บัญชี Anonymous การเปลี่ยนอุปกรณ์ ล้างข้อมูลเบราว์เซอร์ หรือย้ายจาก localhost มา GitHub Pages จะเป็นคนละบัญชีและไม่กู้ข้อมูลเดิมจาก cloud อัตโนมัติ ยังไม่มีหน้าล็อกอินหรือระบบกู้คืนข้ามเครื่อง ข้อมูลทดสอบใน localhost จะไม่ย้ายมาตาม URL ใหม่เอง

## ทดสอบในเครื่อง

ใช้ Node.js 22 ขึ้นไป ไม่ต้องติดตั้งแพ็กเกจเพิ่ม:

    npm test
    npm run check
    npm start

เปิด http://127.0.0.1:4173/ (หากพอร์ตนี้ใช้แล้วให้หยุด preview เดิมก่อน)

## ขอบเขตที่ตรวจแล้ว

ทดสอบสูตรราคาเฉลี่ย ผลกระทบราคา เวลาไทย รอยต่อปฏิทิน สำรองจำลอง คิวเมื่อเครือข่ายล้มเหลว และการโหลดราคาเฉพาะเปิด/กลับมาแอป
การสำรอง Firebase จาก preview เดิมเคยทดสอบเขียนและอ่านกลับสำเร็จ แต่ GitHub Pages และ Worker ของชุดนี้ยังไม่ได้เผยแพร่ ต้องตรวจราคาจริงและสำรองบน URL ใหม่หลัง deploy

แหล่งอ้างอิง:
- https://docs.github.com/en/pages/quickstart
- https://docs.github.com/en/billing/concepts/product-billing/github-actions
- https://developers.cloudflare.com/workers/platform/pricing/
- https://firebase.google.com/pricing
