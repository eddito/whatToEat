"use client";

import { KeyRound, LockKeyhole, Mail } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { isUsernameAccount } from "@/lib/accounts";

type ChangePasswordState = "idle" | "loading" | "success" | "error";

export function ChangePasswordForm() {
  const [username, setUsername] = useState("");
  const [contact, setContact] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [state, setState] = useState<ChangePasswordState>("idle");
  const [message, setMessage] = useState("");
  const isDisabled = state === "loading" || !username.trim() || !contact.trim() || newPassword.length < 8;
  const helperText = useMemo(() => {
    if (state === "success") {
      return message || "密码已修改，可以返回登录。";
    }

    if (state === "error") {
      return message || "密码修改失败，请检查账号和校验方式。";
    }

    return "用户名仅支持小写字母和数字，邮箱或手机号需要与账号绑定信息一致。";
  }, [message, state]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isDisabled) {
      return;
    }

    if (!isUsernameAccount(username)) {
      setState("error");
      setMessage("账号格式不正确：请输入 3-32 位小写字母/数字用户名。");
      return;
    }

    setState("loading");
    setMessage("");

    const response = await fetch("/api/auth/change-password", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        username,
        contact,
        newPassword,
      }),
    });
    const result = (await response.json().catch(() => null)) as { error?: string; message?: string } | null;

    if (!response.ok) {
      setState("error");
      setMessage(getErrorMessage(result?.error));
      return;
    }

    setState("success");
    setMessage("密码已修改，可以返回登录。");
    setNewPassword("");
  }

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <label className="field">
        <span>
          <KeyRound aria-hidden="true" size={15} />
          用户名
        </span>
        <input
          autoComplete="username"
          inputMode="text"
          name="username"
          onChange={(event) => setUsername(event.target.value)}
          placeholder="例如 testuser"
          type="text"
          value={username}
        />
      </label>

      <label className="field">
        <span>
          <Mail aria-hidden="true" size={15} />
          邮箱或手机号
        </span>
        <input
          autoComplete="email"
          inputMode="email"
          name="contact"
          onChange={(event) => setContact(event.target.value)}
          placeholder="绑定邮箱或手机号"
          type="text"
          value={contact}
        />
      </label>

      <label className="field">
        <span>
          <LockKeyhole aria-hidden="true" size={15} />
          新密码
        </span>
        <input
          autoComplete="new-password"
          minLength={8}
          name="new-password"
          onChange={(event) => setNewPassword(event.target.value)}
          placeholder="至少 8 位"
          type="password"
          value={newPassword}
        />
      </label>

      <p className={state === "error" ? "auth-helper auth-helper-error" : "auth-helper"}>{helperText}</p>
      <button className="button auth-submit" disabled={isDisabled} type="submit">
        {state === "loading" ? "修改中..." : "修改密码"}
      </button>
    </form>
  );
}

function getErrorMessage(error?: string) {
  switch (error) {
    case "contact_mismatch":
      return "邮箱或手机号与账号不匹配。";
    case "weak_password":
      return "新密码至少需要 8 位。";
    case "invalid_username":
      return "账号格式不正确，不能包含中文或特殊字符。";
    case "profile_not_found":
      return "账号不存在。";
    case "contact_not_configured":
      return "这个账号还没有绑定可校验的邮箱或手机号。";
    default:
      return "密码修改失败，请检查账号和校验方式。";
  }
}
