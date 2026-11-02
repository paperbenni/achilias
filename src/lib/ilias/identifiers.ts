/** Reference, thread, and post IDs use the same bounded ILIAS integer format. */
export function validObjectId(id: string) {
  return /^[1-9]\d{0,11}$/.test(id);
}
