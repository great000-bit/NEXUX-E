// The shared email layout. In the repository this is the same file the expert emails use; the deploy step copies the real
// file here, because a deployed function can only import its own folder.
export * from '../send-confirmation-emails/status-emails.ts'
