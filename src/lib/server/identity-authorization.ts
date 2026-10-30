export function assertProjectPublisher(
  project: { publisherUserId: string | null; publisherAddress: string },
  identity: { userId: string; wallet: string },
) {
  if (
    project.publisherAddress.toLowerCase() !== identity.wallet.toLowerCase() ||
    (project.publisherUserId !== null && project.publisherUserId !== identity.userId)
  ) {
    throw new Error('Only the original project owner can manage this project')
  }
}
