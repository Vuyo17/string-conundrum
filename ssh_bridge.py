import argparse
import os
import shlex
import socket
import sys

try:
    from dotenv import load_dotenv
except ImportError as exc:
    raise SystemExit(
        "Missing dependency: python-dotenv. Install with: pip install python-dotenv paramiko"
    ) from exc

try:
    import paramiko
except ImportError as exc:
    raise SystemExit(
        "Missing dependency: paramiko. Install with: pip install python-dotenv paramiko"
    ) from exc


def required_env(name: str) -> str:
    value = os.getenv(name, "").strip()
    if not value:
        raise SystemExit(f"Missing required env var: {name}")
    return value


def connect_ssh(host: str, port: int, user: str, password: str, sock=None) -> paramiko.SSHClient:
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(
        hostname=host,
        port=port,
        username=user,
        password=password,
        sock=sock,
        timeout=20,
        allow_agent=False,
        look_for_keys=False,
    )
    return client


def exec_command(client: paramiko.SSHClient, command: str) -> int:
    stdin, stdout, stderr = client.exec_command(command)
    out = stdout.read().decode("utf-8", errors="replace")
    err = stderr.read().decode("utf-8", errors="replace")

    if out:
        print(out, end="")
    if err:
        print(err, end="", file=sys.stderr)

    return stdout.channel.recv_exit_status()


def interactive_loop(client: paramiko.SSHClient) -> None:
    print("Connected. Type commands to run on target server.")
    print("Type 'exit' or 'quit' to leave.")

    while True:
        try:
            raw = input("ssh> ").strip()
        except (EOFError, KeyboardInterrupt):
            print()
            break

        if not raw:
            continue
        if raw in {"exit", "quit"}:
            break

        code = exec_command(client, raw)
        print(f"[exit {code}]")


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Run commands on a target SSH server via jump host using .env credentials."
    )
    parser.add_argument(
        "--env-file",
        default=".env",
        help="Path to .env file (default: .env)",
    )
    parser.add_argument(
        "--cmd",
        default="",
        help="Run one command on target and exit. If omitted, opens interactive mode.",
    )
    parser.add_argument(
        "--strict-host-key",
        action="store_true",
        help="Enable strict host key checking (advanced).",
    )

    args = parser.parse_args()

    load_dotenv(args.env_file)

    target_host = required_env("SSH_TARGET_HOST")
    target_user = required_env("SSH_TARGET_USER")
    target_pass = required_env("SSH_TARGET_PASS")
    target_port = int(os.getenv("SSH_TARGET_PORT", "22"))

    use_jump = os.getenv("SSH_USE_JUMP", "true").strip().lower() in {
        "1",
        "true",
        "yes",
        "on",
    }

    jump_host = os.getenv("SSH_JUMP_HOST", "").strip()
    jump_user = os.getenv("SSH_JUMP_USER", "").strip()
    jump_pass = os.getenv("SSH_JUMP_PASS", "").strip()
    jump_port = int(os.getenv("SSH_JUMP_PORT", "22"))

    jump_client = None
    target_client = None

    try:
        if use_jump:
            if not jump_host or not jump_user or not jump_pass:
                raise SystemExit(
                    "SSH_USE_JUMP is enabled but jump host credentials are incomplete."
                )

            jump_client = connect_ssh(jump_host, jump_port, jump_user, jump_pass)

            jump_transport = jump_client.get_transport()
            if jump_transport is None:
                raise RuntimeError("Failed to get jump host transport")

            dest_addr = (target_host, target_port)
            local_addr = ("127.0.0.1", 0)

            try:
                channel = jump_transport.open_channel("direct-tcpip", dest_addr, local_addr)
                target_client = connect_ssh(
                    host=target_host,
                    port=target_port,
                    user=target_user,
                    password=target_pass,
                    sock=channel,
                )
            except Exception:
                print(
                    "Jump forwarding unavailable, falling back to direct target connection.",
                    file=sys.stderr,
                )
                if jump_client:
                    jump_client.close()
                    jump_client = None
                target_client = connect_ssh(
                    host=target_host,
                    port=target_port,
                    user=target_user,
                    password=target_pass,
                )
        else:
            target_client = connect_ssh(
                host=target_host,
                port=target_port,
                user=target_user,
                password=target_pass,
            )

        if args.cmd:
            return exec_command(target_client, args.cmd)

        interactive_loop(target_client)
        return 0

    except (paramiko.SSHException, socket.error, RuntimeError) as exc:
        print(f"SSH error: {exc}", file=sys.stderr)
        return 1
    finally:
        if target_client:
            target_client.close()
        if jump_client:
            jump_client.close()


if __name__ == "__main__":
    raise SystemExit(main())
