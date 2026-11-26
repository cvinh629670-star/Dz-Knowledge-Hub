# Dz-Knowledge Hub

**Second Brain for a Better You** là website học tập cá nhân bằng tiếng Việt, thiết kế theo phong cách Anime Fantasy RPG. Phase 1 gồm tám phân hệ học tập dùng được trên trình duyệt, với dữ liệu mẫu Python và tiến độ bắt đầu từ 0.

## Chạy trên máy

Mở terminal trong thư mục dự án. Nếu đã cài Python, chạy:

```powershell
py -m http.server 4173 --bind 127.0.0.1
```

Trên macOS hoặc Linux, dùng `python3 -m http.server 4173 --bind 127.0.0.1`. Mở `http://127.0.0.1:4173/` trên trình duyệt. Website chạy trực tiếp từ mã nguồn bằng HTTP với JavaScript mô-đun. PWA dùng HTTPS hoặc địa chỉ loopback khi phát triển.

Lần đầu, giữ kết nối đến khi thấy **Sẵn sàng học offline** trên thanh đầu trang hoặc dưới cùng màn hình điện thoại. Sau đó có thể tải lại và học ngoại tuyến. Trình duyệt có hỗ trợ cài PWA sẽ cung cấp lựa chọn cài đặt trong thanh địa chỉ hoặc menu. Ảnh từ URL bên ngoài do người dùng chèn cần kết nối khi chưa có trong bộ nhớ đệm của trình duyệt.

## Dùng bộ mẫu Python

| Bước | Thao tác |
| --- | --- |
| 1 | Từ Tổng quan, chọn **Bắt đầu học**. Đọc bài Pareto đầu, xem ví dụ và chọn **Hoàn thành bài học**. |
| 2 | Mở **Phòng luyện tập**. Thử trả lời sai câu trắc nghiệm, xem giải thích rồi mở **Sổ tay lỗi sai** để làm lại. Bài tập tự luận, lập trình và tình huống dùng tự đánh giá theo lời giải. |
| 3 | Mở **Active Recall**, chọn chủ đề Python, nhập câu trả lời trước khi xem đáp án và tự đánh giá. Phiên ôn ưu tiên câu đã trả lời sai hoặc nội dung có bằng chứng còn yếu. |
| 4 | Mở **Ôn tập Flashcard**, lật thẻ và chọn **Again**, **Hard**, **Good** hoặc **Easy**. Xem lịch kế tiếp, số đúng/sai và quản lý thẻ trong bộ thẻ. |
| 5 | Mở **Cây kỹ năng** để thấy kỹ năng kế tiếp mở sau khi hoàn thành bài tiên quyết. Dùng nút hoặc bàn phím để thu phóng, kéo nền để di chuyển và chọn một kỹ năng để xem chi tiết. Có thể tạo cây bằng cách thêm kỹ năng vào một nhánh mới. |
| 6 | Quay về **Tổng quan** để xem EXP, chuỗi ngày, hoạt động, thẻ đến hạn và nhiệm vụ được tính từ nhật ký học. Chỉnh hồ sơ và mục tiêu trong **Cài đặt & dữ liệu**. |

Thư viện có 12 lĩnh vực mặc định, 4 bài học Pareto, 14 bài tập thuộc 7 dạng, 12 flashcard và 6 kỹ năng mẫu. Bạn có thể thêm lĩnh vực, tạo bài riêng có chủ đề và chương, gắn thẻ, đánh dấu yêu thích, liên kết bài và đính kèm tệp. Mỗi bài hỗ trợ tối đa 5 tệp, 3 MB mỗi tệp. Nội dung bài học hỗ trợ Markdown an toàn, ảnh HTTP(S), khối mã và công thức MathML từ cú pháp toán cơ bản (chẳng hạn `$a^2$` và `$\frac{1}{2}$`).

Lịch flashcard dựa trên SM-2 và điều chỉnh theo bốn mức đánh giá. **Again** hẹn lại sau 10 phút, còn lần đầu chọn **Hard**, **Good** hoặc **Easy** sẽ hẹn sau 12 giờ, 1 ngày hoặc 4 ngày. Sau đó hệ thống cập nhật khoảng cách ôn theo lịch sử của từng thẻ. [Thuật toán gốc của SuperMemo](https://www.supermemo.com/en/articles/history)

Phase 1 cấp 20 EXP khi hoàn thành bài, 10 EXP cho lần giải đúng đầu tiên của mỗi bài tập và 5 EXP cho mỗi thẻ được ôn mỗi ngày. Kỹ năng thành thạo cần bằng chứng từ hoàn thành bài, luyện tập, Active Recall và ôn tập lặp lại.

## Dữ liệu và sao lưu

- Dữ liệu học, tệp đính kèm và lịch sử nằm trong IndexedDB theo địa chỉ trang và hồ sơ trình duyệt. Chủ đề giao diện lưu bằng LocalStorage.
- Vào **Cài đặt & dữ liệu → Xuất JSON** để sao lưu toàn bộ dữ liệu và giao diện. **Nhập JSON** kiểm tra lược đồ, các quan hệ và dữ liệu tiến độ trước khi xin xác nhận thay thế dữ liệu hiện tại.
- **Đặt lại dữ liệu** cần xác nhận và nạp lại nội dung mẫu. Xuất một bản sao trước khi đổi trình duyệt, đổi địa chỉ website hoặc xóa dữ liệu trang.

## Triển khai GitHub Pages

1. Tạo kho GitHub và đẩy nội dung dự án vào thư mục gốc của nhánh `main`, gồm cả `.nojekyll`.
2. Mở **Settings → Pages**. Trong **Build and deployment**, chọn **Deploy from a branch**, nhánh `main`, thư mục `/ (root)`, rồi bấm **Save**.
3. Mở địa chỉ Pages hiển thị trong **Settings → Pages**. Đường dẫn tương đối và điều hướng hash hỗ trợ cả website đặt dưới tên kho. Kiểm tra lần đầu trên HTTPS và thử tải lại khi ngoại tuyến. [Hướng dẫn GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)

## Kiến trúc và phát triển tiếp

- `index.html`, `css/` và `assets/` chứa giao diện, theme, font Việt hóa, ảnh, biểu tượng và quy tắc responsive.
- `js/app.js`, `router.js` và `ui.js` nối các mô-đun giao diện với router hash, điểm cập nhật dữ liệu và thành phần dùng chung.
- `js/database.js` xử lý IndexedDB, giao dịch và định dạng sao lưu có phiên bản. `js/gamification.js` ghi nhật ký và tính EXP, level, streak. `data/` cung cấp bộ mẫu cho hồ sơ mới và khi đặt lại dữ liệu.
- `manifest.json` và `sw.js` cấu hình PWA. Khi phát hành tài nguyên mới, cập nhật danh sách tệp và `VERSION` trong `sw.js`. Khi đổi lược đồ, thêm migration cho cả IndexedDB và JSON sao lưu trước khi tăng phiên bản dữ liệu.
- Phase 2 thêm Learning Roadmap, Feynman Room, Project Lab, Learning Analytics, rank dựa trên kiểm tra/ghi nhớ/vận dụng và mở khóa thành tựu từ các định nghĩa trong `data/achievements.json`. Loại hoạt động cho Feynman, chủ đề, thành thạo và dự án đã có vị trí trong mô hình nhật ký.
- Phase 3 thêm dịch vụ AI Tutor, hỗ trợ tạo bài tập và nhận xét Feynman, cá nhân hóa lộ trình và đồng bộ. Tích hợp qua dịch vụ riêng khi có tài khoản hoặc mô hình thực tế, giữ khóa bí mật ở phía máy chủ.

Hai font cục bộ dùng giấy phép SIL Open Font License trong `assets/fonts/`. Ảnh hero `assets/backgrounds/grimoire.webp` được tạo bằng công cụ ImageGen tích hợp.

<details>
<summary>Prompt tạo ảnh</summary>

> Original raster hero background for Dz-Knowledge Hub, an Anime Fantasy RPG × Modern Learning Dashboard. Panoramic cinematic landscape. On the right half, an open antique leather grimoire hovering above a rough stone pedestal in an enchanted dark forest archive, its parchment emanating golden light and small drifting purple magical sparks. Luminous lavender crystals and a few soft turquoise fireflies, black-blue tree silhouettes and distant purple fog. Painterly high-end anime game key art, fine illustrated detail, mysterious and serene. The focal book is at about 76% of the width and 52% of the height, large and legible. Keep the entire left 42% dark understated purple-black with atmospheric depth and very few details, for live white interface copy. Dark indigo #0F1020, midnight purple, violet #8B5CF6, accents of soft gold. Wide 3:1 composition designed for a short site banner, keep the important parts in the central vertical third. No character, text, lettering, numbers, interface, logos, or watermark.

</details>
