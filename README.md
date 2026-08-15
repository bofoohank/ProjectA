# ProjectA

Ứng dụng desktop quản lý SFX, audio, GIF và video dành cho editor.

## Chạy ở chế độ phát triển

```powershell
pnpm install
pnpm dev
```

## Đóng gói Windows

```powershell
pnpm build
```

File portable sẽ được tạo trong thư mục `dist` hoặc `release` tùy phiên bản electron-builder.

## Dữ liệu

ProjectA chỉ đọc file media. Metadata (tag, favorite, collection và index) được lưu trong thư mục ứng dụng của người dùng bằng `electron-store`; file gốc không bị sửa hoặc di chuyển.
