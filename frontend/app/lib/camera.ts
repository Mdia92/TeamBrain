import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import { isCapacitorNative } from "@/app/lib/capacitor-env";

export async function captureFieldReportPhoto(): Promise<string | null> {
  if (!isCapacitorNative()) return null;
  const photo = await Camera.getPhoto({
    quality: 80,
    allowEditing: false,
    resultType: CameraResultType.DataUrl,
    source: CameraSource.Camera,
  });
  return photo.dataUrl ?? null;
}

export function pickFieldReportPhotoFromFiles(): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.capture = "environment";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
      reader.readAsDataURL(file);
    };
    input.click();
  });
}

export async function attachFieldReportPhoto(): Promise<string | null> {
  if (isCapacitorNative()) {
    try {
      return await captureFieldReportPhoto();
    } catch {
      return null;
    }
  }
  return pickFieldReportPhotoFromFiles();
}
