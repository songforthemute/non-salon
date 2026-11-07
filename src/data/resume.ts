import { RESUME_LINK, SITE } from "@/config";

interface ResumeLink {
	label: string;
	href: string;
}

type SectionId = "experience" | "work" | "writing" | "skills" | "education";

export interface ResumeContent {
	title: string;
	description: string;
	profile: {
		name: string;
		role: string;
		summary: readonly string[];
		links: readonly ResumeLink[];
	};
	contentsLabel: string;
	sections: Record<SectionId, { title: string; navLabel: string }>;
	experience: readonly { period: string; company: string; role: string; summary: string }[];
	projects: readonly {
		category: string;
		name: string;
		href: string;
		description: string;
		technologies: readonly string[];
	}[];
	writing: { slugs: readonly string[]; publications: ResumeLink };
	skills: readonly string[];
	education: readonly { area: string; school?: string }[];
}

export interface ResumeWriting {
	title: string;
	href: string;
	date: string;
}

export const RESUME_CONTENT: ResumeContent = {
	title: RESUME_LINK.label,
	description: `${SITE.author}의 공개 이력서. 웹 프론트엔드 프로젝트와 기술 글을 소개합니다.`,
	profile: {
		name: SITE.author,
		role: "Software Engineer · Web / Front-end",
		summary: [
			"디자인을 전공한 소프트웨어 엔지니어입니다.",
			"TypeScript와 React로 사람이 기억하고 판단할 일을 줄이는 웹 인터페이스를 만듭니다.",
		],
		links: [
			{ label: "Email", href: `mailto:${SITE.email}` },
			{ label: "GitHub", href: SITE.authorUrl },
		],
	},
	contentsLabel: "On this page",
	sections: {
		experience: { title: "Experience", navLabel: "Experience" },
		work: { title: "Selected Work", navLabel: "Work" },
		writing: { title: "Selected Writing", navLabel: "Writing" },
		skills: { title: "Skills", navLabel: "Skills" },
		education: { title: "Education", navLabel: "Education" },
	},
	experience: [],
	projects: [
		{
			category: "개인 프로젝트",
			name: SITE.name,
			href: "/",
			description:
				"Notion에 쓴 글을 정적 HTML로 발행하는 개인 기술 아카이브입니다. Pagefind로 글을 검색할 수 있습니다.",
			technologies: ["Astro", "Notion API", "Pagefind", "Cloudflare Pages"],
		},
	],
	writing: {
		slugs: ["predicate-combinator-i18n", "client-side-slow-traffic-spike", "state-reducer-pattern"],
		publications: { label: "Publications", href: "/publications" },
	},
	skills: ["TypeScript", "React", "Web"],
	education: [{ area: "디자인 전공" }],
};
