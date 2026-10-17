# ThaiTeX: Overleaf ฉบับเต็มสำหรับใช้เอง + ภาษาไทย

ต่อยอดจาก [Overleaf Extended Community Edition (CE+)](https://github.com/yu-i-i/overleaf-cep)
v6.3.0-ext-v5.1 ซึ่งเป็นโอเพนซอร์ส (AGPL-3.0) และมีฟีเจอร์ระดับ Pro มาให้ฟรี

## มีอะไรบ้าง

**จาก CE+ (ฟีเจอร์ระดับ Pro)**
- แก้ไขพร้อมกันหลายคนแบบเรียลไทม์ ผู้ร่วมงานไม่จำกัด
- Track changes และ comments
- History เต็มรูปแบบ: ดู diff, ย้อนเวอร์ชัน, ตั้ง label
- Git integration, GitHub sync, Zotero
- Template gallery, Symbol palette, Reference search
- นำเข้าไฟล์ `.docx` / `.md` และส่งออกเป็น `.docx` / `.md` / `.html`
- Sandboxed compiles, LDAP / SAML / OIDC, หน้าจัดการผู้ใช้และโปรเจกต์

**ที่เพิ่มในฉบับนี้**
- **ฟอนต์ UI เป็น Google Sans Flex ทั้งระบบ** ตัวอักษรไทยใช้ Noto Sans Thai ช่วยแสดงผล ส่วน editor โค้ดยังเป็นฟอนต์ monospace ตามเดิม
- **หน้า `/fonts` สำหรับอัปโหลดฟอนต์:** ลากไฟล์มาวาง, ดูพรีวิวภาษาไทย, คัดลอกโค้ด `\setmainfont{...}`, ลบฟอนต์ได้ ฟอนต์ที่อัปโหลดใช้ได้ทุกโปรเจกต์ทันที (Admin → Manage Fonts)
- **New Project → Thai project (XeLaTeX):** ได้โปรเจกต์ที่ตั้งค่า XeLaTeX, polyglossia, ฟอนต์ Sarabun และตัดคำไทยไว้พร้อม
- **ฟอนต์ไทยติดตั้งในระบบคอมไพล์:** Sarabun, Noto Sans/Serif Thai, Laksaman (TH Sarabun), Garuda, Loma, Kinnari และชุด TLWG
- **TeX Live แบบ full** (scheme-full) ครบทุกแพ็กเกจเหมือน overleaf.com และเวลาคอมไพล์สูงสุด 240 วินาที

## วิธีติดตั้ง (บนคอมพิวเตอร์หรือเซิร์ฟเวอร์ที่มี Docker)

ต้องใช้ Linux, macOS หรือ Windows (WSL2) ที่มี Docker แนะนำ RAM 8 GB และพื้นที่ดิสก์ว่าง 20 GB ขึ้นไป

```bash
git clone <repo นี้> thaitex && cd thaitex
cp server-ce/.dockerignore .

# 1) base image: TeX Live full + ฟอนต์ไทย (ครั้งแรกใช้เวลา 1-2 ชั่วโมง)
docker build -f server-ce/Dockerfile-base -t thaitex/sharelatex-base:latest .

# 2) แอป (ประมาณ 20-40 นาที)
docker build -f server-ce/Dockerfile \
  --build-arg OVERLEAF_BASE_TAG=thaitex/sharelatex-base:latest \
  -t thaitex/sharelatex:latest .

# 3) เปิดระบบ
docker compose -f thai/docker-compose.yml up -d
```

เปิด http://localhost/launchpad แล้วสร้างบัญชีแอดมินคนแรก จากนั้นเข้าใช้ที่ http://localhost

อยากได้ image เล็กและ build เร็ว ให้เพิ่ม `--build-arg TEXLIVE_SCHEME=scheme-basic` ในขั้นที่ 1
แต่แพ็กเกจ LaTeX จะมีแค่ส่วนน้อย

## ใช้ภาษาไทย

เลือก New Project → **Thai project (XeLaTeX)** ได้เลย หรือใส่ส่วนนี้ในโปรเจกต์เดิม
แล้วเปลี่ยน Menu → Compiler เป็น XeLaTeX:

```latex
\usepackage{fontspec}
\usepackage{polyglossia}
\setdefaultlanguage{thai}
\setotherlanguage{english}
\setmainfont{Sarabun}[Script=Thai, Scale=1.1]
\newfontfamily\thaifont{Sarabun}[Script=Thai, Scale=1.1]
\XeTeXlinebreaklocale "th"
\XeTeXlinebreakskip = 0pt plus 1pt
```

ฟอนต์ที่อัปโหลดในหน้า `/fonts` เรียกได้ด้วยชื่อ family ตามที่แสดงในหน้านั้น

## ข้อควรรู้

- **ใช้เองหรือกับคนที่ไว้ใจ** ถ้ายังไม่เปิด Sandboxed Compiles ใครคอมไพล์ได้ก็เข้าถึงไฟล์ใน container ได้
  ถ้าจะเปิดให้คนทั่วไปใช้ ต้องเปิด Sandboxed Compiles (ดู [wiki ของ CE+](https://github.com/yu-i-i/overleaf-cep/wiki))
  และฟอนต์จากหน้า `/fonts` ต้อง mount `/var/lib/overleaf/data/fonts` เข้า container ที่ใช้คอมไพล์ด้วย
- **License AGPL-3.0:** ถ้านำไปเปิดให้คนอื่นใช้ผ่านเว็บ (โดยเฉพาะถ้าเก็บเงิน) ต้องเปิดซอร์สโค้ดที่แก้ไขให้ผู้ใช้ด้วย
- ห้ามใช้ชื่อหรือโลโก้ Overleaf ในการขาย ให้ตั้งชื่อแบรนด์เองผ่าน `OVERLEAF_APP_NAME` และ `OVERLEAF_NAV_TITLE`
