import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const storageMocks = vi.hoisted(() => ({
  storageFrom: vi.fn(),
  getUser: vi.fn(),
  upload: vi.fn(),
  getPublicUrl: vi.fn(),
  createSignedUrl: vi.fn(),
  remove: vi.fn(),
}));

vi.mock("./supabase.js", () => ({
  supabaseEnabled: true,
  supabaseClient: {
    auth: { getUser: storageMocks.getUser },
    storage: {
      from(bucket) {
        storageMocks.storageFrom(bucket);
        return {
          upload: storageMocks.upload,
          getPublicUrl: storageMocks.getPublicUrl,
          createSignedUrl: storageMocks.createSignedUrl,
          remove: storageMocks.remove,
        };
      },
    },
  },
}));

import { storageService } from "./storage.service.js";

describe("storage policy compatibility", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => vi.restoreAllMocks());

  it("uploads avatars under the verified Auth UUID without requesting overwrite", async () => {
    storageMocks.getUser.mockResolvedValue({ data: { user: { id: "auth-user-1" } }, error: null });
    storageMocks.upload.mockResolvedValue({ error: null });
    storageMocks.getPublicUrl.mockReturnValue({ data: { publicUrl: "https://storage.invalid/avatar" } });
    const now = vi.spyOn(Date, "now").mockReturnValue(1234);

    await expect(storageService.uploadAvatar("caller-controlled-id", {
      name: "avatar.png", size: 1, type: "image/png",
    })).resolves.toBe("https://storage.invalid/avatar");

    expect(storageMocks.storageFrom).toHaveBeenCalledWith("avatars");
    expect(storageMocks.upload).toHaveBeenCalledWith("auth-user-1/avatar/1234.png", expect.any(Object), expect.objectContaining({ upsert: false }));
    now.mockRestore();
  });

  it("uses only policy-approved private student document paths", async () => {
    storageMocks.upload.mockResolvedValue({ error: null });
    storageMocks.createSignedUrl.mockResolvedValue({ data: { signedUrl: "https://storage.invalid/signed" }, error: null });
    const now = vi.spyOn(Date, "now").mockReturnValue(1234);

    await expect(storageService.uploadDocument("STU-1", {
      name: "id proof.pdf", size: 1, type: "application/pdf",
    }, "id_proof")).resolves.toEqual({
      path: "STU-1/id_proof/1234_id_proof.pdf",
      signedUrl: "https://storage.invalid/signed",
    });

    expect(storageMocks.storageFrom).toHaveBeenCalledWith("documents");
    expect(storageMocks.upload).toHaveBeenCalledWith("STU-1/id_proof/1234_id_proof.pdf", expect.any(Object), expect.objectContaining({ upsert: false }));
    await expect(storageService.uploadDocument("STU-1/other", {
      name: "id proof.pdf", size: 1, type: "application/pdf",
    }, "general")).rejects.toThrow("valid student ID");
    await expect(storageService.uploadDocument("STU-1", {
      name: "id proof.pdf", size: 1, type: "application/pdf",
    }, "other")).rejects.toThrow("Unsupported document category");
    now.mockRestore();
  });

  it("never attempts storage deletion while no approved delete policy exists", async () => {
    await expect(storageService.deleteFile("documents", "STU-1/id_proof/1234.pdf"))
      .rejects.toThrow("Storage deletion is disabled");
    expect(storageMocks.storageFrom).not.toHaveBeenCalled();
    expect(storageMocks.remove).not.toHaveBeenCalled();
  });
});
