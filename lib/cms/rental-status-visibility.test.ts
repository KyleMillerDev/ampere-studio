import { describe, expect, it } from "vitest"

import { getRentalVisibilityMessage } from "@/lib/cms/rental-status-visibility"

describe("getRentalVisibilityMessage", () => {
  it("uses future tense on new listings", () => {
    expect(getRentalVisibilityMessage("active", { isEdit: false }).text).toBe(
      "Your rental will be visible on your website."
    )
    expect(getRentalVisibilityMessage("rented", { isEdit: false }).text).toBe(
      "Your rental will not be visible on your website."
    )
  })

  it("uses present tense when the saved status is unchanged", () => {
    expect(
      getRentalVisibilityMessage("active", {
        isEdit: true,
        savedStatus: "active",
      }).text
    ).toBe("Your rental is currently visible on your website.")

    expect(
      getRentalVisibilityMessage("rented", {
        isEdit: true,
        savedStatus: "rented",
      }).text
    ).toBe("Your rental is currently not visible on your website.")
  })

  it("switches back to future tense after an unsaved change", () => {
    expect(
      getRentalVisibilityMessage("rented", {
        isEdit: true,
        savedStatus: "active",
      }).text
    ).toBe("Your rental will not be visible on your website.")

    expect(
      getRentalVisibilityMessage("active", {
        isEdit: true,
        savedStatus: "rented",
      }).text
    ).toBe("Your rental will be visible on your website.")
  })
})
