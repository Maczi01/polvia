import { JSX } from 'react';
import { highlight } from 'sugar-high';
import { MDXRemote, MDXRemoteProps } from 'next-mdx-remote/rsc';
import {
    EnglishMediaTable,
    PolishMediaTable,
} from '@/app/[locale]/blog/_components/polish-media-table-pl';
import { DataProcessingTableEN, DataProcessingTablePL } from '@/app/[locale]/blog/_components/data-processing-table';

function Code({ children, ...props }: any) {
    const codeHTML = highlight(children);
    return <code dangerouslySetInnerHTML={{ __html: codeHTML }} {...props} />;
}

function Link({ children, href, ...props }: any) {
    return (
        <a
            href={href}
            {...props}
            className="text-blue-500 underline decoration-blue-500 transition-colors duration-200 hover:text-blue-700 hover:decoration-blue-700"
            target={href?.startsWith('http') ? '_blank' : undefined}
            rel={href?.startsWith('http') ? 'noopener noreferrer' : undefined}
            style={{
                color: '#3b82f6',
                textDecoration: 'underline',
                textDecorationColor: '#3b82f6',
                transition: 'color 0.2s, text-decoration-color 0.2s',
            }}
        >
            {children}
        </a>
    );
}

const components = {
    code: Code,
    a: Link,
    PolishMediaTable,
    EnglishMediaTable,
    DataProcessingTablePL,
    DataProcessingTableEN
};

export const MDXContent = (props: JSX.IntrinsicAttributes & MDXRemoteProps) => {
    return <MDXRemote {...props} components={{ ...components, ...props.components }} />;
};
