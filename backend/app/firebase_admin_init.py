import firebase_admin
from firebase_admin import credentials

# Temporary: embedded service account while deployment has no env vars.
SERVICE_ACCOUNT = {
    'type': 'service_account',
    'project_id': 'string-conundrum',
    'private_key_id': 'c6a1903cdbfa93ff95cc5d1a93d1e5b069d420db',
    'private_key': (
        '-----BEGIN PRIVATE KEY-----\n'
        'MIIEvwIBADANBgkqhkiG9w0BAQEFAASCBKkwggSlAgEAAoIBAQC+xkqMHC8goJbS\n'
        'bIBMcaBvz7+5oTORs1b31xB5dqsG2pZD2upr0QCRJ+Xd/LEj/TYnlPSqjuorH/ru\n'
        '+8mecb4jPOM2vnDbT2fOpYE9P1qTr80yV9HwKvrufkuagGb5bbm9SpAQFqCoBPTG\n'
        'EBuBa0pTcsaviygmoDxaYqLS06TtI01Vj3VbIxKzmJdIwC84jybGplZa01Id3g+r\n'
        'DqXezF0dVfFhPsSJmlC9SrQ5j7tB8Y1642Htkg6RiOp/7g1L/X86+egVeWap1zep\n'
        'pEOnCHaDTEZXZMiJGcZGdqhUcAQX+r5hu7c2l9V8AoLrXBrJJv4P93729kTC2wlo\n'
        '1iDVX9ujAgMBAAECggEAARV4kKFaXM6IVLyOAKEuu6SqCFsusLJaUlN9pwTX8n/e\n'
        '7xUMWnnGcdnJukZhSYGFi/krFNXI+CR3HNckvNJAHqRG8oLQfag5Lcp1tqciS1kZ\n'
        '9TMaD9ScFJETycoB5TYI5KEIegHpUC309Oz5eltOU3ejGmq2h8BZPvNyBJGZM0+5\n'
        'EhjYZSH2fUgxrD0E/vnrrc5zK0U90m5mis7R/K6vS690ZKtYUObaNTDxDAqDkeDT\n'
        'QeQw+c6vGJ5XLC6QFnqKCv13eHnEQuLt0Y25B1N3pRUIk1vljfrJDESw09Ajpe56\n'
        'ILfWz2cs7TkLc+c15UOobUlpcO+bUpwbh288CL+VYQKBgQDh936gdrAIgiAeGNLz\n'
        'L7tTUSYcdUKo5tZ4yCJcX+08XZuSgVx4bstkQOvJ+yEIRSH2EE4ahzdfgOKDy03m\n'
        'omu1ZnDIcIrC12z3g44ZogIRConOuzFUPyS2kiwAlpZfBbuS0lF+DToaESEbwPRI\n'
        't8FWDrG+V6c6LJqb2oBwsinMIQKBgQDYIWJW1vU2CzpC+NqFtRrHsHUsCTEyBQnY\n'
        'Hf0GNMwy0EjcRv3au0ts3jRybOxr6wpLjBR2CpyDd7h5gZ58qslsM4/8DVUuWLoP\n'
        'ApZ9oBrOcct2YBKrVNPjKe/I6A6oTHsxkGxmJAEMV+017CQ9nD4thDGKijPQQAFi\n'
        's1BM5kmPQwKBgQCPpcQrwge6AO7l8yX3TrqpBodRxAFyWfyxn5ioXJr1qxRBGFdu\n'
        'gBBwVQ0Pw8OF/FzQjiD4oEjFP6u/2LhXC52pHcxIv7KWllhBKLJm/SSPLMHaWAnN\n'
        '4q42Gco7PX+uPHi3p1gC5+mttIH1oL4qlBYl3QWFWTeHtd87gLXx7nC/wQKBgQDC\n'
        'Ai2xQCI7khaJebNG5MwWRqrXjaTQfr9YdYrkoE5QqrFMspk7WHcbUdeIg4gyU3kZ\n'
        'WbQgReQ7CyPYRmdLB0/pxdtQ6XL2OIVD5hHK0QZfHL0EFLeNfob5WnK5SL2ni4fm\n'
        'dPspMNaUCvWPOttJRtB1sT17XBWosVvNCqNhdDLB2wKBgQDfNU0EDksG94B2Bzb0\n'
        'YSNUt/G0xKpEJyf0d80mwQrrU+tcU+ANA0AD+nxkxFTQJBZfUGpEpVROp618Zkvj\n'
        'uI6NMw0Y7j7KB78zgpcWaIHNFm6kKZS1KacHErzhW2QGdFY7MesNueMjIiDqKU+0\n'
        'dl2tTS1KqXnD8YeoQD0RQcKcYw==\n'
        '-----END PRIVATE KEY-----\n'
    ),
    'client_email': 'firebase-adminsdk-fbsvc@string-conundrum.iam.gserviceaccount.com',
    'client_id': '111809949493480773405',
    'auth_uri': 'https://accounts.google.com/o/oauth2/auth',
    'token_uri': 'https://oauth2.googleapis.com/token',
    'auth_provider_x509_cert_url': 'https://www.googleapis.com/oauth2/v1/certs',
    'client_x509_cert_url': 'https://www.googleapis.com/robot/v1/metadata/x509/firebase-adminsdk-fbsvc%40string-conundrum.iam.gserviceaccount.com',
}


def init_firebase_admin():
    if firebase_admin._apps:
        return firebase_admin.get_app()

    cred = credentials.Certificate(SERVICE_ACCOUNT)
    return firebase_admin.initialize_app(cred)
