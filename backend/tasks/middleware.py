import logging
from urllib.parse import parse_qs

from channels.db import database_sync_to_async
from channels.middleware import BaseMiddleware
from django.contrib.auth.models import AnonymousUser
from rest_framework_simplejwt.tokens import AccessToken
from rest_framework_simplejwt.exceptions import TokenError

logger = logging.getLogger(__name__)


@database_sync_to_async
def get_user_from_token(token_str):
    try:
        logger.info('Attempting JWT decode for token: %s', token_str[:20] + '...' if len(token_str) > 20 else token_str)
        token = AccessToken(token_str)
        logger.info('Token decoded successfully. user_id=%s', token.get('user_id'))

        from django.contrib.auth import get_user_model
        User = get_user_model()
        user = User.objects.get(id=token['user_id'])
        logger.info('User fetched from DB: user_id=%s username=%s', user.id, user.username)
        return user
    except TokenError as exc:
        logger.error('WebSocket JWT TokenError: %s', exc)
        return AnonymousUser()
    except KeyError as exc:
        logger.error('WebSocket JWT KeyError (missing claim): %s', exc)
        return AnonymousUser()
    except User.DoesNotExist as exc:
        logger.error('WebSocket JWT user not found: %s', exc)
        return AnonymousUser()
    except Exception as exc:
        logger.error('WebSocket JWT unexpected error: %s', exc, exc_info=True)
        return AnonymousUser()


class JWTAuthMiddleware(BaseMiddleware):
    async def __call__(self, scope, receive, send):
        raw_qs = scope.get('query_string', b'')
        logger.info('WS query_string (raw bytes): %r', raw_qs)

        query_string = raw_qs.decode('utf-8')
        logger.info('WS query_string (decoded): %s', query_string)

        params = parse_qs(query_string)
        token_list = params.get('token')

        if token_list:
            token_str = token_list[0]
            logger.info('WS extracted token (length=%d): %s...', len(token_str), token_str[:20])
            scope['user'] = await get_user_from_token(token_str)
        else:
            logger.warning('WS no token found in query_string. keys=%s', list(params.keys()))
            scope['user'] = AnonymousUser()

        logger.info('WS scope user: %s (authenticated=%s)', scope['user'], getattr(scope['user'], 'is_authenticated', False))
        return await super().__call__(scope, receive, send)
