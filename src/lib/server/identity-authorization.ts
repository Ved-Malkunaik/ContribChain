export function assertProjectPublisher(
  project: { publisherUserId: string | null; publisherAddress: string },
  identity: { userId: string; wallet: string },
) {
  if (
    project.publisherUserId !== identity.userId ||
    project.publisherAddress.toLowerCase() !== identity.wallet.toLowerCase()
  ) {
    throw new Error('Only the original project owner identity can manage this project')
  }
}
