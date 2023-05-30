import { AuthorAssociation } from '@octokit/webhooks-types'

export let ignoredAuthorAssociations: AuthorAssociation[] = []

if (typeof process.env.IGNORED_AUTHOR_ASSOCIATIONS === 'string') {
  ignoredAuthorAssociations = process.env.IGNORED_AUTHOR_ASSOCIATIONS.split(
    /,; /gi
  ).map(i => i.toUpperCase()) as AuthorAssociation[]
}
