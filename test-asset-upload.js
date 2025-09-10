import fetch from "node-fetch"
import fs from "fs"
import path from "path"
import FormData from "form-data"

async function testAssetUpload() {
  try {
    // Create a simple test image (1x1 pixel PNG)
    const testImageBuffer = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
      0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00,
      0x0b, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
      0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49,
      0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
    ])

    const formData = new FormData()
    formData.append("file", testImageBuffer, {
      filename: "test.png",
      contentType: "image/png",
    })
    formData.append("assetId", "test-asset-123")
    formData.append("originalName", "test.png")

    console.log("Uploading test asset...")

    const response = await fetch("http://localhost:3001/api/assets", {
      method: "POST",
      body: formData,
    })

    const result = await response.json()
    console.log("Upload result:", result)

    // Test getting assets list
    console.log("Getting assets list...")
    const listResponse = await fetch("http://localhost:3001/api/assets-list")
    const listResult = await listResponse.json()
    console.log("Assets list:", listResult)
  } catch (error) {
    console.error("Test failed:", error)
  }
}

testAssetUpload()
