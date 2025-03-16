import clsx from "clsx";
import { LazyMotion, m, domAnimation } from "framer-motion";
import type { HTMLProps, ReactNode, ComponentProps } from "react";
import { useState } from "react";
import { Button } from "react-aria-components";

type Props = Omit<HTMLProps<HTMLDivElement>, "title"> & {
  title?: ReactNode | undefined;
  questions: {
    question: ReactNode;
    answer: ReactNode;
  }[];
};

export const Faq = ({ title, questions, className, ...props }: Props) => {
  const [openItem, setOpenItem] = useState(0);

  return (
    <LazyMotion features={domAnimation}>
      <div
        className={clsx("flex flex-col gap-2 lg:flex-row lg:gap-10", className)}
        {...props}
      >
        {title && (
          <div className="flex-none text-3xl font-light lg:w-2/5">{title}</div>
        )}
        <dl className="flex flex-col divide-y divide-neutral-600/50 lg:grow">
          {questions.map(({ question, answer }, i) => (
            <div key={i} className="flex flex-col py-6">
              <dt>
                <Button
                  className="-mx-2 flex w-[calc(100%_+_1rem)] flex-row items-start justify-between gap-4 p-2 focus:outline-none focus-visible:ring-1 focus-visible:ring-pythpurple-400 md:gap-8"
                  onPress={() => {
                    setOpenItem(i);
                  }}
                >
                  <div className="max-w-prose text-left font-bold lg:text-lg">
                    {question}
                  </div>
                  <svg
                    viewBox="0 0 8 8"
                    stroke="currentColor"
                    className="relative mt-[.35rem] size-4 flex-none"
                  >
                    <line
                      x1="4"
                      y1="0"
                      x2="4"
                      y2="9"
                      className={clsx("origin-center transition duration-300", {
                        "rotate-90": openItem === i,
                      })}
                    />
                    <line x1="0" y1="4" x2="9" y2="4" />
                  </svg>
                </Button>
              </dt>
              <m.dt
                className="-mt-1 flex max-w-prose flex-col gap-4 overflow-hidden font-light"
                initial={{ height: openItem === i ? "auto" : 0 }}
                animate={{ height: openItem === i ? "auto" : 0 }}
              >
                {answer}
              </m.dt>
            </div>
          ))}
        </dl>
      </div>
    </LazyMotion>
  );
};

type FaqSectionProps = Omit<HTMLProps<HTMLDivElement>, "children"> & {
  questions: ComponentProps<typeof Faq>["questions"];
  header: ReactNode;
};

export const FaqSection = ({
  className,
  header,
  questions,
  ...props
}: FaqSectionProps) => (
  <section className={clsx("mb-28 last:mb-0", className)} {...props}>
    <h2 className="text-xl font-light sm:text-2xl">{header}</h2>
    <Faq className="ml-4 sm:ml-10" questions={questions} />
  </section>
);
