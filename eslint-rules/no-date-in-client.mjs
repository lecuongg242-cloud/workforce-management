/**
 * D-19a: cam doc dong ho may (`new Date()` khong tham so, `Date.now()`) o
 * client component ("use client"). "Hom nay" phai den tu server qua prop
 * (xem `src/lib/today.ts`) -- doc dong ho may o lan ve dau tien gay lech
 * hydration giua markup server va trinh duyet (day chinh la ly do V1 phai
 * dong bang REFERENCE_DATE thay vi doc dong ho that -- xem D-19).
 *
 * Rule nay CHI ap dung cho file co chi thi "use client" trong phan mo dau
 * chuong trinh (directive prologue). Quet TOAN BO cac ExpressionStatement la
 * chuoi lien tiep tu dau `Program.body`, khong chi gia dinh no luon nam o
 * phan tu dau tien -- mien nhiem voi truong hop mot chi thi khac (vi du
 * "use strict") hoac mot chuoi khac dung truoc "use client".
 *
 * Cho phep `new Date(...)` CO tham so (vi du dung lai mot ngay ISO nhan qua
 * prop) -- chi dang KHONG tham so moi la "doc dong ho may". Bao nham o day
 * se khien nguoi ta muon tat rule, dung dieu D-19a duoc dung de ngan.
 */

/**
 * @param {import("estree").Statement[]} programBody
 * @returns {boolean}
 */
function hasUseClientDirective(programBody) {
  for (const statement of programBody) {
    const isStringLiteralExpressionStatement =
      statement.type === "ExpressionStatement" &&
      statement.expression.type === "Literal" &&
      typeof statement.expression.value === "string";

    if (!isStringLiteralExpressionStatement) {
      // Gap phan tu dau tien khong phai directive -- het phan mo dau, dung
      // quet.
      break;
    }

    if (statement.expression.value === "use client") {
      return true;
    }

    // Mot chi thi khac (vi du "use strict") -- tiep tuc quet phan con lai
    // cua directive prologue.
  }

  return false;
}

const MESSAGE_NEW_DATE =
  "D-19a: khong duoc doc dong ho may bang `new Date()` (khong tham so) trong client component. Nhan 'hom nay' qua prop tu Server Component -- xem src/lib/today.ts.";
const MESSAGE_DATE_NOW =
  "D-19a: khong duoc doc dong ho may bang `Date.now()` trong client component. Nhan 'hom nay' qua prop tu Server Component -- xem src/lib/today.ts.";

/** @type {import("eslint").Rule.RuleModule} */
const noDateInClientRule = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Cam doc dong ho may (new Date() khong tham so / Date.now()) trong client component (D-19a).",
    },
    schema: [],
    messages: {
      noDateInClient: MESSAGE_NEW_DATE,
      noDateNowInClient: MESSAGE_DATE_NOW,
    },
  },
  create(context) {
    const sourceCode = context.sourceCode ?? context.getSourceCode();
    const program = sourceCode.ast;

    if (!hasUseClientDirective(program.body)) {
      // Khong phai client component -- rule khong lam gi.
      return {};
    }

    return {
      "NewExpression[callee.name='Date']"(node) {
        if (node.arguments.length === 0) {
          context.report({ node, messageId: "noDateInClient" });
        }
      },
      "CallExpression[callee.object.name='Date'][callee.property.name='now']"(
        node,
      ) {
        context.report({ node, messageId: "noDateNowInClient" });
      },
    };
  },
};

const timeflowNoDateInClientPlugin = {
  rules: {
    "no-date-in-client": noDateInClientRule,
  },
};

export default timeflowNoDateInClientPlugin;
