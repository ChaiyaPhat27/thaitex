import logger from '@overleaf/logger'
import AuthenticationController from '../../../../app/src/Features/Authentication/AuthenticationController.mjs'
import AuthorizationMiddleware from '../../../../app/src/Features/Authorization/AuthorizationMiddleware.mjs'
import RateLimiterMiddleware from '../../../../app/src/Features/Security/RateLimiterMiddleware.mjs'
import { RateLimiter } from '../../../../app/src/infrastructure/RateLimiter.mjs'
import FontManagerController from './FontManagerController.mjs'

const rateLimiterUpload = new RateLimiter('font-manager-upload', {
  points: 30,
  duration: 60,
})

export default {
  apply(webRouter) {
    logger.debug({}, 'Init font manager router')

    webRouter.get(
      '/fonts',
      AuthenticationController.requireLogin(),
      FontManagerController.fontsPage
    )
    webRouter.get(
      '/fonts/list',
      AuthenticationController.requireLogin(),
      FontManagerController.listFontsJson
    )
    webRouter.get(
      '/fonts/file/:fileName',
      AuthenticationController.requireLogin(),
      FontManagerController.serveFont
    )
    webRouter.post(
      '/fonts/upload',
      AuthorizationMiddleware.ensureUserIsSiteAdmin,
      RateLimiterMiddleware.rateLimit(rateLimiterUpload),
      FontManagerController.uploadMiddleware,
      FontManagerController.uploadFonts
    )
    webRouter.post(
      '/fonts/:fileName/delete',
      AuthorizationMiddleware.ensureUserIsSiteAdmin,
      FontManagerController.deleteFont
    )
  },
}
