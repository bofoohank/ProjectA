# ProjectA

ProjectA là ứng dụng desktop quản lý SFX, audio, GIF và video dành cho editor. Ứng dụng quét media từ nhiều thư mục, tạo waveform, preview trực tiếp, phân loại theo thư mục, tìm kiếm, gắn tag, favorite, collection và export thư viện.

ProjectA hỗ trợ:

- Windows 10/11 x64.
- macOS Apple Silicon ARM64: M1, M2, M3 và M4.

> ProjectA chỉ đọc file media gốc. Các thao tác đổi danh mục, tag, favorite hoặc xóa khỏi thư viện không sửa và không xóa file gốc trên ổ đĩa.

## Tính năng chính

- Quản lý SFX/audio và Video/GIF trong cùng một ứng dụng.
- Tạo danh mục tự động theo tên thư mục cha.
- Preview SFX và video bằng cách di chuột; rê ngang preview để scrub.
- Lưu cache waveform để lần mở sau không phải phân tích lại.
- Tự cập nhật khi file trong thư mục theo dõi được thêm, xóa hoặc đổi tên.
- Phát hiện và gộp file trùng theo hash, tên, thời lượng và waveform.
- Tìm kiếm, lọc, tag, favorite và collection.
- Kéo file sang phần mềm dựng phim có hỗ trợ nhận file kéo-thả.
- Export metadata JSON và media theo cấu trúc SFX/Video.
- Dark mode và màu Theme tùy chỉnh.

## Yêu cầu phát triển

Cài đặt:

- [Node.js 22](https://nodejs.org/)
- [pnpm 10](https://pnpm.io/installation)
- Git

Kiểm tra phiên bản:

```bash
node --version
pnpm --version
git --version
```

Clone và cài dependency:

```bash
git clone https://github.com/bofoohank/ProjectA.git
cd ProjectA
pnpm install
```

FFmpeg và FFprobe được cài qua dependency của project, không cần cài thủ công vào hệ thống.

## Chạy ở chế độ phát triển

Trên Windows hoặc macOS:

```bash
pnpm dev
```

Chỉ build phần giao diện:

```bash
pnpm build
```

## Build cho Windows

Thực hiện trên máy Windows:

```powershell
pnpm install --frozen-lockfile
pnpm run dist:win
```

File portable được tạo tại:

```text
dist/ProjectA-0.1.0-Windows.exe
```

Không cần cài đặt; chạy trực tiếp file `.exe`.

## Build cho macOS Apple Silicon

Thực hiện trên máy Mac dùng chip M1/M2/M3/M4:

```bash
pnpm install --frozen-lockfile
pnpm run dist:mac
```

Kết quả nằm trong thư mục `dist`:

```text
dist/ProjectA-0.1.0-macOS-arm64.dmg
dist/ProjectA-0.1.0-macOS-arm64.zip
```

### Cài bằng DMG

1. Mở file `.dmg`.
2. Kéo `ProjectA.app` vào `Applications`.
3. Mở `Applications` và chạy ProjectA.

### Cảnh báo Gatekeeper

Bản build hiện chưa được ký và notarize bằng Apple Developer. Nếu macOS chặn ứng dụng:

1. Mở `System Settings`.
2. Chọn `Privacy & Security`.
3. Tìm thông báo ProjectA bị chặn.
4. Chọn `Open Anyway` rồi xác nhận `Open`.

Bạn cũng có thể nhấp chuột phải vào `ProjectA.app`, chọn `Open`, sau đó xác nhận.

## Build tự động bằng GitHub Actions

Workflow: `.github/workflows/build-desktop.yml`.

Workflow tự chạy khi:

- Push lên `main`.
- Push tag bắt đầu bằng `v`, ví dụ `v0.1.0`.
- Chạy thủ công bằng nút `Run workflow`.

Cách tải bản build:

1. Mở repository trên GitHub.
2. Chọn tab `Actions`.
3. Chọn workflow `Build desktop apps`.
4. Mở lần chạy đã hoàn tất.
5. Tải artifact `ProjectA-Windows` hoặc `ProjectA-macOS-Apple-Silicon`.

Artifact macOS được build trực tiếp trên runner Apple M1/ARM64, không dùng Rosetta.

## Cách sử dụng

### Thêm thư mục

1. Mở `Settings`.
2. Tại hàng `Thư mục`, chọn nút thêm thư mục.
3. Chọn một hoặc nhiều thư mục chứa media.
4. ProjectA tự đưa audio vào `SFX`, GIF/video vào `Video`, và dùng tên thư mục cha làm danh mục con.

### Xóa thư mục khỏi thư viện

1. Mở `Settings`.
2. Chọn đường dẫn trong danh sách.
3. Nhấn nút xóa thư mục.

Thao tác này chỉ gỡ thư mục khỏi ProjectA. Nút thùng rác đỏ xóa toàn bộ đường dẫn và media khỏi thư viện. Cả hai thao tác đều không xóa file gốc.

### Preview media

- Di chuột vào thẻ SFX hoặc Video để phát.
- Rê ngang waveform/preview để scrub.
- Rời khỏi thẻ để dừng và quay lại đầu.

### Export thư viện

Trong `Settings`, nhấn Export và chọn thư mục đích. ProjectA tạo:

```text
ProjectA-Export-<thời gian>/
├── projecta-library.json
└── Media/
    ├── SFX/
    │   └── <tên danh mục>/
    └── Video/
        └── <tên danh mục>/
```

JSON chứa metadata; `Media` chứa bản sao các file đang hiển thị trong thư viện.

## Cache và dữ liệu cục bộ

ProjectA lưu cục bộ danh sách thư mục, index media, file trùng, tag, favorite, collection, waveform và chính sách cache.

Đường dẫn mặc định:

- Windows: `%APPDATA%/projecta/Cache/ProjectA`
- macOS: `~/Library/Application Support/projecta/Cache/ProjectA`

Có thể đổi vị trí cache trong `Settings`. Xóa cache chỉ xóa waveform và dữ liệu tạm, không xóa media gốc.

## Chuyển dữ liệu giữa Windows và macOS

Đường dẫn file trên hai hệ điều hành khác nhau. Khi chuyển metadata sang máy khác, hãy thêm lại thư mục media để ProjectA lập index với đường dẫn mới. Không nên để hai máy cùng sử dụng đồng thời một thư mục cache trên ổ mạng.

## Script

| Lệnh | Chức năng |
|---|---|
| `pnpm dev` | Chạy chế độ phát triển |
| `pnpm build` | Build giao diện production |
| `pnpm run dist:win` | Tạo Windows portable x64 |
| `pnpm run dist:mac` | Tạo DMG và ZIP macOS Apple Silicon ARM64 |
| `pnpm test` | Chạy Vitest |

## Công nghệ

- Electron
- React
- Vite
- electron-builder
- FFmpeg/FFprobe
- electron-store

## Tác giả

[@xh4nk](https://github.com/bofoohank)
